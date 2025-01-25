import { PrismaClient } from "@prisma/client"
import { createClient } from "redis"
import readline from "readline"
import axios from "axios"
import { parse, HTMLElement } from "node-html-parser"
import {
	Dav,
	UsersController,
	SessionsController,
	User,
	Auth,
	Environment,
	isSuccessStatusCode
} from "dav-js"
import { createStoreBook, updateStoreBook } from "./resolvers/storeBook.js"
import { publishStoreBookRelease } from "./resolvers/storeBookRelease.js"
import {
	getLastReleaseOfStoreBook,
	getTableObjectFileCdnUrl,
	downloadFile
} from "./utils.js"
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
	database: process.env.ENV == "production" ? 5 : 4 // production: 5, staging: 4
})

redis.on("error", err => console.log("Redis Client Error", err))
await redis.connect()
//#endregion

// Init dav
let environment = Environment.Development

switch (process.env.ENV) {
	case "production":
		environment = Environment.Production
		break
	case "staging":
		environment = Environment.Staging
		break
}

new Dav({
	environment,
	server: true
})

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
let createSessionResponse = await SessionsController.createSession(
	`accessToken`,
	{
		auth: new Auth({
			apiKey: process.env.DAV_API_KEY,
			secretKey: process.env.DAV_SECRET_KEY,
			uuid: process.env.DAV_UUID
		}),
		email,
		password,
		appId,
		apiKey: process.env.DAV_API_KEY
	}
)

let accessToken = ""

if (!Array.isArray(createSessionResponse)) {
	accessToken = createSessionResponse.accessToken
}

let user: User
let userResponse = await UsersController.retrieveUser(
	`
		id
		email
		firstName
		plan
	`,
	{ accessToken }
)

if (!Array.isArray(userResponse)) {
	user = userResponse
}

let initialResponse = await axios({
	method: "get",
	url: `https://standardebooks.org/ebooks?per-page=${perPage}`
})

const root = parse(initialResponse.data)

let pagesOl = root.querySelector("nav > ol")
let pages = pagesOl.querySelectorAll("li").length

for (let i = pages; i >= 1; i--) {
	console.log(`\n\nPage ${i}\n`)

	let response = await axios({
		method: "get",
		url: `https://standardebooks.org/ebooks?page=${i}&view=list&per-page=${perPage}`
	})

	let ebooksList = parse(response.data).querySelector("ol.ebooks-list")

	for (let child of ebooksList
		.querySelectorAll(`li[typeof="schema:Book"]`)
		.reverse()) {
		// Get the title
		const titleSpan = child.querySelector(`span[property="schema:name"]`)
		const title = titleSpan.textContent

		// Get the name of the author
		const authorAnchors = child.querySelectorAll("p.author > a")
		if (authorAnchors.length > 1) continue

		const authorAnchor = authorAnchors[0]
		if (authorAnchor == null) continue

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
			return true
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
			const description = getDescriptionOfBookPage(root)

			// Get the tags
			const categoryKeys = await getTagsOfBookPage(root)

			// Check for a series
			const isPartOfLink = root.querySelector(
				`a[property="schema:isPartOf"]`
			)

			if (isPartOfLink != null) {
				const seriesName = isPartOfLink.textContent
				const seriesUrl = isPartOfLink.getAttribute("href")

				console.log(`Series detected: ${seriesName} (${seriesUrl})`)
			}

			// Get the epub file url
			const epubAnchor = root.querySelector("a.epub")
			const epubUrl = baseUrl + epubAnchor.getAttribute("href")

			// Download the epub file
			let epubBuffer = await downloadFile(epubUrl)

			// Download the cover file
			let coverBuffer = await downloadFile(coverUrl)

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
					{ user, accessToken, prisma, redis, resend: null }
				)

				storeBookUuid = createStoreBookResponse.uuid
			} catch (error) {
				console.log(
					`There was an issue with creating the StoreBook ${title} (${bookUrl})`
				)
				console.error(error)
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
				console.error(error)
				return false
			}

			// Upload the epub file
			try {
				await axios({
					method: "put",
					url: `${apiBaseUrl}/storeBooks/${storeBookUuid}/file`,
					headers: {
						"Content-Type": "application/epub+zip",
						"Content-Disposition": `attachment; filename="${encodeURI(
							title
						)}.epub"`,
						Authorization: accessToken
					},
					data: epubBuffer
				})
			} catch (error) {
				console.log(
					`There was an issue with uploading the epub file of ${title} (${epubUrl})`
				)
				console.error(error)
				return false
			}

			// Set the status of the StoreBook to review
			try {
				await updateStoreBook(
					null,
					{
						uuid: storeBookUuid,
						status: "review"
					},
					{ user, accessToken, prisma, redis, resend: null }
				)
			} catch (error) {
				console.log(
					`There was an issue with setting the status of the StoreBook ${title} (${bookUrl})`
				)
				console.log(error)
				return false
			}
		} else {
			storeBook = storeBooks[0]
			let storeBookUpdated = false

			// Get the last release of the StoreBook
			const storeBookRelease = await getLastReleaseOfStoreBook(
				prisma,
				storeBook.id
			)
			let storeBookRelease2 = await prisma.storeBookRelease.findFirst({
				where: { uuid: storeBookRelease.uuid },
				include: { categories: true, cover: true, file: true }
			})

			// Check if the book details have changed
			// Get the data from the book page
			let bookPageResponse = await axios({
				method: "get",
				url: `${baseUrl}${bookUrl}`
			})

			const root = parse(bookPageResponse.data)

			// Get the description
			const description = getDescriptionOfBookPage(root)

			// Get the tags
			const categoryKeys = await getTagsOfBookPage(root)

			// Check if the categories or tags have changed
			let bookChanged =
				categoryKeys.length != storeBookRelease2.categories.length

			if (!bookChanged) {
				for (let key of categoryKeys) {
					if (
						storeBookRelease2.categories.findIndex(c => c.key == key) ==
						-1
					) {
						bookChanged = true
						break
					}
				}
			}

			if (!bookChanged) {
				bookChanged = storeBookRelease.description != description
			}

			if (bookChanged) {
				// Update the StoreBook with the new values
				await updateStoreBook(
					null,
					{
						uuid: storeBook.uuid,
						description,
						categories: categoryKeys
					},
					{ user, accessToken, prisma, redis, resend: null }
				)

				storeBookUpdated = true
			}

			// Check if the cover file has changed
			let storeBookCoverSize = 0

			if (storeBookRelease2.cover != null) {
				storeBookCoverSize = await getFileSize(
					getTableObjectFileCdnUrl(storeBookRelease2.cover.uuid)
				)
			}

			const bookCoverSize = await getFileSize(coverUrl)

			if (storeBookCoverSize != bookCoverSize) {
				// Download the new cover
				let coverBuffer = await downloadFile(coverUrl)

				// Upload the cover
				try {
					await axios({
						method: "put",
						url: `${apiBaseUrl}/storeBooks/${storeBook.uuid}/cover`,
						headers: {
							"Content-Type": "image/jpeg",
							Authorization: accessToken
						},
						data: coverBuffer
					})
				} catch (error) {
					console.log(
						`There was an issue with uploading the new cover of ${title} (${coverUrl})`
					)
					console.error(error)
					return false
				}

				storeBookUpdated = true
			}

			// Check if the epub file has changed
			const epubAnchor = root.querySelector("a.epub")
			const epubUrl = baseUrl + epubAnchor.getAttribute("href")
			let storeBookEpubFileSize = 0

			if (storeBookRelease2.file != null) {
				storeBookEpubFileSize = await getFileSize(
					getTableObjectFileCdnUrl(storeBookRelease2.file.uuid)
				)
			}

			const bookEpubFileSize = await getFileSize(epubUrl)

			if (storeBookEpubFileSize != bookEpubFileSize) {
				// Download the new epub file
				let epubBuffer = await downloadFile(epubUrl)

				// Upload the epub file
				try {
					await axios({
						method: "put",
						url: `${apiBaseUrl}/storeBooks/${storeBook.uuid}/file`,
						headers: {
							"Content-Type": "application/epub+zip",
							"Content-Disposition": `attachment; filename="${encodeURI(
								title
							)}.epub"`,
							Authorization: accessToken
						},
						data: epubBuffer
					})
				} catch (error) {
					console.log(
						`There was an issue with uploading the new epub file of ${title} (${epubUrl})`
					)
					console.error(error)
					return false
				}

				storeBookUpdated = true
			}

			if (
				storeBook.status == "published" &&
				(storeBookUpdated || storeBookRelease2.status != "published")
			) {
				// Publish the new release
				let latestStoreBookRelease =
					await prisma.storeBookRelease.findFirst({
						where: { storeBookId: storeBook.id, status: "unpublished" }
					})

				if (latestStoreBookRelease != null) {
					// Get the link to the last commit
					const lastChangeListItem = root.querySelector(
						"section#history > ol > li"
					)
					const commitDate =
						lastChangeListItem.querySelector("time").textContent
					const commitUrl = lastChangeListItem
						.querySelector("p > a")
						.getAttribute("href")
					let commitUrlParts = commitUrl.split("/")
					const revision = commitUrlParts[
						commitUrlParts.length - 1
					].substring(0, 7)

					await publishStoreBookRelease(
						null,
						{
							uuid: latestStoreBookRelease.uuid,
							releaseName: `Update to revision ${revision}`,
							releaseNotes: `Automatic update based on commit ${commitUrl} from ${commitDate}`
						},
						{ user, accessToken, prisma, redis, resend: null }
					)
				}
			}
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

//#region Util functions
function getDescriptionOfBookPage(root: HTMLElement): string {
	const descriptionSectionParagraphs = root.querySelectorAll(
		"section#description > p"
	)

	return descriptionSectionParagraphs.map(p => p.textContent).join("\n\n")
}

async function getTagsOfBookPage(root: HTMLElement): Promise<string[]> {
	const tagListItems = root.querySelectorAll("ul.tags > li")
	let categoryKeys = []

	for (let item of tagListItems) {
		let tag = item
			.querySelector("a")
			.textContent.toLowerCase()
			.replace(" ", "-")
			.replace("’", "")

		// Try to find the tag in the database
		let category = await prisma.category.findFirst({
			where: { key: tag }
		})

		if (category == null) {
			console.log(`Category ${tag} doesn't exist!`)
		} else {
			categoryKeys.push(category.key)
		}

		if (categoryKeys.length >= 3) break
	}

	return categoryKeys
}

async function getFileSize(url: string): Promise<number> {
	try {
		let response = await axios({
			method: "head",
			url
		})

		if (response.headers["Content-Length"] != null) {
			return Number(response.headers["Content-Length"])
		}

		// Download the entire file
		let response2 = await axios({
			method: "get",
			url,
			responseType: "arraybuffer"
		})

		return Buffer.from(response2.data, "binary").length
	} catch (error) {}

	return 0
}
//#endregion

process.exit()
