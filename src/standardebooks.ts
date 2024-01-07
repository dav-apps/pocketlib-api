import { PrismaClient } from "@prisma/client"
import * as crypto from "crypto"
import axios from "axios"
import { parse } from "node-html-parser"
import {
	createTableObject,
	setTableObjectPrice
} from "./services/apiService.js"
import { storeBookTableId } from "./constants.js"

const prisma = new PrismaClient()
const perPage = 12
const baseUrl = "https://standardebooks.org"

let initialResponse = await axios({
	method: "get",
	url: `https://standardebooks.org/ebooks?per-page=${perPage}`
})

const root = parse(initialResponse.data)

let pagesOl = root.querySelector("nav > ol")
let pages = pagesOl.querySelectorAll("li").length
const startPage = 1

for (let i = startPage; i <= pages; i++) {
	let response = await axios({
		method: "get",
		url: `https://standardebooks.org/ebooks?page=${i}&view=list&per-page=${perPage}`
	})

	let ebooksList = parse(response.data).querySelector("ol.ebooks-list")

	for (let child of ebooksList.querySelectorAll(`li[typeof="schema:Book"]`)) {
		// Get the title
		const titleSpan = child.querySelector(`span[property="schema:name"]`)
		const title = titleSpan.textContent

		// Get the name of the author
		const authorAnchor = child.querySelector("p.author > a")
		const authorName = authorAnchor.textContent
		const authorUrl = authorAnchor.getAttribute("href")

		// Get the url to the book page
		const titleAnchor = child.querySelector(`a[property="schema:url"]`)
		const bookUrl = titleAnchor.getAttribute("href")

		// Get the urls to the cover files
		const jpgSource = child.querySelector(`source[type="image/jpg"]`)
		const jpgSrcSet = jpgSource.getAttribute("srcset")
		let jpgs = jpgSrcSet.split(",")

		if (jpgs.length <= 1) {
			console.log(`${title} (on page ${i}) has only one cover!`)
			continue
		}

		let largeCoverUrl = baseUrl + jpgs[0].trim().split(" ")[0]
		let smallCoverUrl = baseUrl + jpgs[1].trim().split(" ")[0]

		console.log(`${authorName}: ${title}`)

		let saveResult = await saveBook(
			title,
			bookUrl,
			authorName,
			authorUrl,
			smallCoverUrl,
			largeCoverUrl
		)

		if (!saveResult) break
	}

	if (i == startPage) break
}

async function saveBook(
	title: string,
	bookUrl: string,
	authorName: string,
	authorUrl: string,
	smallCoverUrl: string,
	largeCoverUrl: string
): Promise<boolean> {
	// Check if the author mapping is already in the database
	const authorMapping = await prisma.standardEbooksAuthorMapping.findFirst({
		where: { url: authorUrl },
		include: { author: true }
	})

	let author = authorMapping?.author

	if (author == null) {
		// Find the author in the database
		let authors = await prisma.author.findMany({
			where: {
				firstName: { in: authorName.split(" ") },
				lastName: { in: authorName.split(" ") }
			}
		})

		if (authors.length == 0) {
			console.log(
				`The author ${authorName} (${baseUrl}${authorUrl}) does not exist!`
			)
			return false
		} else if (authors.length > 1) {
			console.log(
				`There are multiple authors for ${authorName} (${baseUrl}${authorUrl})`
			)
			return false
		} else {
			// Create a new author mapping
			author = authors[0]

			await prisma.standardEbooksAuthorMapping.create({
				data: {
					author: { connect: { id: author.id } },
					url: authorUrl
				}
			})
		}
	}

	// Check if the store book mapping is already in the database
	const storeBookMapping =
		await prisma.standardEbooksStoreBookMapping.findFirst({
			where: { url: bookUrl },
			include: { storeBook: true }
		})

	let storeBook = storeBookMapping?.storeBook

	if (storeBook == null) {
		// Find the store book in the database
		let storeBooks = await prisma.storeBook.findMany({
			where: {
				collection: { author: { id: author.id } },
				releases: { some: { title } }
			}
		})

		if (storeBooks.length > 1) {
			console.log(
				`There are multiple StoreBooks for ${title} (${baseUrl}${bookUrl})`
			)
			return false
		} else if (storeBooks.length == 0) {
			console.log(
				`Creating the StoreBook ${title} (${baseUrl}${bookUrl})...`
			)

			// Get the data from the book page
			let bookPageResponse = await axios({
				method: "get",
				url: `${baseUrl}${bookUrl}`
			})

			const root = parse(bookPageResponse.data)

			const descriptionSectionParagraphs = root.querySelectorAll(
				"section#description > p"
			)
			const description = descriptionSectionParagraphs
				.map(p => p.textContent)
				.join("\n\n")

			const tagListItems = root.querySelectorAll("ul.tags > li")
			let categoryIds = []

			for (let item of tagListItems) {
				let tag = item.querySelector("a").textContent.toLowerCase()

				// Try to find the tag in the database
				let category = await prisma.category.findFirst({
					where: { key: tag }
				})

				if (category == null) {
					console.log(`Category ${tag} doesn't exist!`)
					return false
				} else {
					categoryIds.push(category.id)
				}
			}

			// Check for a series
			const isPartOfLink = root.querySelector(
				`a[property="schema:isPartOf"]`
			)

			if (isPartOfLink != null) {
				const seriesName = isPartOfLink.textContent
				const seriesUrl = isPartOfLink.getAttribute("href")

				// Check if the series already exists in the database
				const series = await prisma.storeBookSeries.findFirst({
					where: { name: seriesName }
				})

				if (series == null) {
					console.log(`New Series detected: ${seriesName} (${seriesUrl})`)
				}
			}

			// Create the StoreBookCollection
			const storeBookCollection = await prisma.storeBookCollection.create({
				data: {
					uuid: crypto.randomUUID(),
					author: {
						connect: {
							id: author.id
						}
					}
				}
			})

			// Create the StoreBookCollectionName
			await prisma.storeBookCollectionName.create({
				data: {
					uuid: crypto.randomUUID(),
					collection: {
						connect: {
							id: storeBookCollection.id
						}
					},
					name: title,
					language: "en"
				}
			})

			// Create the StoreBook
			storeBook = await prisma.storeBook.create({
				data: {
					uuid: crypto.randomUUID(),
					collection: {
						connect: {
							id: storeBookCollection.id
						}
					},
					language: "en",
					status: "review"
				}
			})

			// Create the store book release
			let storeBookReleaseProperties = {
				data: {
					uuid: crypto.randomUUID(),
					storeBook: {
						connect: {
							id: storeBook.id
						}
					},
					title: title,
					description,
					price: 0,
					status: "unpublished"
				}
			}

			if (categoryIds.length > 0) {
				storeBookReleaseProperties.data["categories"] = { connect: [] }

				for (let id of categoryIds) {
					storeBookReleaseProperties.data["categories"]["connect"].push({
						id
					})
				}
			}

			await prisma.storeBookRelease.create(storeBookReleaseProperties)

			// Create the store book table object
			let createTableObjectResponse = await createTableObject(
				storeBook.uuid,
				storeBookTableId
			)

			if (createTableObjectResponse == null) {
				console.log(
					`There was an issue with creating the table object for StoreBook ${title} (${storeBook.uuid})`
				)
				return false
			}

			// Set the price of the table object
			let storeBookPrice = await setTableObjectPrice({
				uuid: storeBook.uuid,
				price: 0,
				currency: "eur"
			})

			if (storeBookPrice == null) {
				console.log(
					`There was an issue with creating the table object price for StoreBook ${title} (${storeBook.uuid})`
				)
				return false
			}
		} else {
			storeBook = storeBooks[0]
		}

		// Create a new StoreBook mapping
		await prisma.standardEbooksStoreBookMapping.create({
			data: {
				storeBook: { connect: { id: storeBook.id } },
				url: bookUrl
			}
		})
	}

	return true
}
