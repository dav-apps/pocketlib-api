import { PrismaClient } from "@prisma/client"
import { createClient } from "redis"
import readline from "readline"
import axios from "axios"
import { parse } from "node-html-parser"
import {
	SessionsController,
	Auth,
	isSuccessStatusCode,
	ApiResponse
} from "dav-js"
import { getUser } from "./services/apiService.js"
import { createStoreBook } from "./resolvers/storeBook.js"
import { User } from "./types.js"
import { appId } from "./constants.js"

//#region Constants
const prisma = new PrismaClient()
const perPage = 12
const apiBaseUrl = "http://localhost:4001"
const baseUrl = "https://standardebooks.org"
//#endregion

//#region Redis client
const redis = createClient<any, any, any>({
	url: process.env.REDIS_URL,
	database: process.env.ENVIRONMENT == "production" ? 5 : 4 // production: 5, staging: 4
})

redis.on("error", err => console.log("Redis Client Error", err))
await redis.connect()
//#endregion

// Get the email and password from the user
const rl = readline.createInterface({
	input: process.stdin,
	output: process.stdout
})

const email = await new Promise<string>(resolve => {
	rl.question("Please enter your email address\n", email => resolve(email))
})

const password = await new Promise<string>(resolve => {
	rl.question("\nPlease enter your password\n", password => resolve(password))
})

// Create the session
let createSessionResponse = await SessionsController.CreateSession({
	auth: new Auth({
		apiKey: process.env.DAV_API_KEY,
		secretKey: process.env.DAV_SECRET_KEY,
		uuid: process.env.DAV_UUID
	}),
	email,
	password,
	appId,
	apiKey: process.env.DAV_API_KEY
})

let accessToken = ""

if (isSuccessStatusCode(createSessionResponse.status)) {
	let createSessionResponseData = (
		createSessionResponse as ApiResponse<SessionsController.SessionResponseData>
	).data

	accessToken = createSessionResponseData.accessToken
}

let userResponse = await getUser(accessToken)
let user: User

if (isSuccessStatusCode(userResponse.status)) {
	user = userResponse.data
}

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
			console.log(`${title} (${baseUrl}${bookUrl}) has only one cover!`)
			continue
		}

		let smallCoverUrl = baseUrl + jpgs[1].trim().split(" ")[0]

		console.log(`${authorName}: ${title}`)

		let saveResult = await saveBook(
			title,
			bookUrl,
			authorName,
			authorUrl,
			smallCoverUrl
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
	coverUrl: string
): Promise<boolean> {
	// Check if the author mapping is already in the database
	const authorMapping = await prisma.standardEbooksAuthorMapping.findFirst({
		where: { url: authorUrl },
		include: { author: true }
	})

	let author = authorMapping?.author

	if (author == null) {
		// Find the author in the database
		let authorNameParts = authorName.split(" ")
		let firstNamePart = authorNameParts[0]
		let lastNamePart = authorNameParts[authorNameParts.length - 1]

		let authorWhere = {
			firstName: { contains: firstNamePart },
			lastName: { contains: lastNamePart }
		}

		let authorWhere2 = {
			OR: [
				{ firstName: { equals: authorName } },
				{ lastName: { equals: authorName } }
			]
		}

		let authors = await prisma.author.findMany({
			where: authorName.includes(" ") ? authorWhere : authorWhere2
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

			// Get the description
			const descriptionSectionParagraphs = root.querySelectorAll(
				"section#description > p"
			)
			const description = descriptionSectionParagraphs
				.map(p => p.textContent)
				.join("\n\n")

			// Get the tags
			const tagListItems = root.querySelectorAll("ul.tags > li")
			let categoryKeys = []

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
					categoryKeys.push(category.key)
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

			// Get the epub file url
			const epubAnchor = root.querySelector("a.epub")
			const epubUrl = baseUrl + epubAnchor.getAttribute("href")

			// Download the epub file
			let epubResponse = await axios({
				method: "get",
				url: epubUrl,
				responseType: "arraybuffer"
			})

			let epubBuffer = Buffer.from(epubResponse.data, "binary")

			// Download the cover file
			let coverResponse = await axios({
				method: "get",
				url: coverUrl,
				responseType: "arraybuffer"
			})

			let coverBuffer = Buffer.from(coverResponse.data, "binary")

			// Create the StoreBook
			let storeBookUuid = ""

			try {
				let createStoreBookResponse = await createStoreBook(
					null,
					{
						author: author.uuid,
						title,
						description,
						language: "en",
						categories: categoryKeys
					},
					{ user, accessToken, prisma, redis }
				)

				storeBookUuid = createStoreBookResponse.uuid
			} catch (error) {
				console.log(
					`There was an issue with creating the StoreBook ${title} (${bookUrl})`
				)
				console.log(error)
				return false
			}

			// Find the new StoreBook in the database
			storeBook = await prisma.storeBook.findFirst({
				where: { uuid: storeBookUuid }
			})

			// Upload the cover file
			try {
				await axios({
					method: "put",
					url: `${apiBaseUrl}/storeBooks/${storeBookUuid}/cover`,
					headers: {
						"Content-Type": "image/jpeg",
						Authorization: accessToken
					},
					data: coverBuffer
				})
			} catch (error) {
				console.log(
					`There was an issue with uploading the cover of ${title} (${coverUrl})`
				)
				console.log(error.response.data)
				return false
			}

			// Upload the epub file
			try {
				await axios({
					method: "put",
					url: `${apiBaseUrl}/storeBooks/${storeBookUuid}/file`,
					headers: {
						"Content-Type": "application/epub+zip",
						Authorization: accessToken
					},
					data: epubBuffer
				})
			} catch (error) {
				console.log(
					`There was an issue with uploading the epub file of ${title} (${epubUrl})`
				)
				console.log(error.response.data)
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
