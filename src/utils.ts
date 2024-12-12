import { Response } from "express"
import { GraphQLError } from "graphql"
import { encode } from "blurhash"
import { createCanvas, loadImage, Image } from "canvas"
import axios from "axios"
import * as crypto from "crypto"
import {
	PrismaClient,
	StoreBookRelease,
	VlbItem as VlbItemModel,
	VlbAuthor,
	VlbCollection
} from "@prisma/client"
import { TableObjectsController, isSuccessStatusCode } from "dav-js"
import {
	RegexResult,
	ApiError,
	User,
	StoreBook,
	VlbItem,
	VlbGetProductsResponseDataItem,
	VlbGetProductResponseDataContributor,
	VlbGetProductResponseDataCollection,
	VlbGetCollectionResponseDataItem
} from "./types.js"
import {
	storeBookReleaseTableId,
	facebookUsernameRegex,
	instagramUsernameRegex,
	twitterUsernameRegex,
	filenameRegex
} from "./constants.js"
import { apiErrors } from "./errors.js"
import { getUser } from "./services/apiService.js"
import { getProduct } from "./services/vlbApiService.js"

export function throwApiError(error: ApiError) {
	throw new GraphQLError(error.message, {
		extensions: {
			code: error.code,
			http: {
				status: 200
			}
		}
	})
}

export function throwValidationError(...errors: string[]) {
	let filteredErrors = errors.filter(e => e != null)

	if (filteredErrors.length > 0) {
		throw new GraphQLError(apiErrors.validationFailed.message, {
			extensions: {
				code: apiErrors.validationFailed.code,
				errors: filteredErrors
			}
		})
	}
}

export function throwEndpointError(error: ApiError) {
	throw new Error(error.code)
}

export function handleEndpointError(res: Response, e: Error) {
	// Find the error by error code
	let error = Object.values(apiErrors).find(err => err.code == e.message)

	if (error != null) {
		sendEndpointError(res, error)
	} else {
		sendEndpointError(res, apiErrors.unexpectedError)
	}
}

function sendEndpointError(res: Response, error: ApiError) {
	res.status(error.status || 400).json({
		code: error.code,
		message: error.message
	})
}

export async function loadStoreBookData(
	prisma: PrismaClient,
	storeBook: StoreBook,
	published: boolean = true
) {
	// Get the latest release of the StoreBook
	const release = await getLastReleaseOfStoreBook(
		prisma,
		storeBook.id,
		published
	)
	if (release == null) return

	storeBook.title = release.title
	storeBook.description = release.description
	storeBook.price = release.price
	storeBook.printPrice = release.printPrice
	storeBook.isbn = release.isbn
	storeBook.luluPrintableId = release.luluPrintableId
}

export async function getLastReleaseOfStoreBook(
	prisma: PrismaClient,
	storeBookId: bigint,
	published: boolean = false
): Promise<StoreBookRelease> {
	if (published) {
		let release = await prisma.storeBookRelease.findFirst({
			where: {
				storeBookId: storeBookId,
				status: "published",
				publishedAt: { not: null }
			},
			orderBy: {
				publishedAt: "desc"
			}
		})

		if (release != null) {
			return release
		}
	}

	return await prisma.storeBookRelease.findFirst({
		where: { storeBookId: storeBookId },
		orderBy: { id: "desc" }
	})
}

export async function createNewStoreBookRelease(
	prisma: PrismaClient,
	accessToken: string,
	storeBook: StoreBook,
	oldRelease: StoreBookRelease,
	userId: number
): Promise<StoreBookRelease> {
	const uuid = crypto.randomUUID()

	let data = {
		uuid,
		userId,
		storeBook: {
			connect: {
				id: storeBook.id
			}
		},
		title: oldRelease.title,
		description: oldRelease.description,
		price: oldRelease.price,
		printPrice: oldRelease.printPrice,
		isbn: oldRelease.isbn,
		luluPrintableId: oldRelease.luluPrintableId,
		categories: {
			connect: []
		}
	}

	if (oldRelease.coverId != null) {
		data["cover"] = {
			connect: {
				id: oldRelease.coverId
			}
		}
	}

	if (oldRelease.fileId != null) {
		data["file"] = {
			connect: {
				id: oldRelease.fileId
			}
		}
	}

	if (oldRelease.printCoverId != null) {
		data["printCover"] = {
			connect: {
				id: oldRelease.printCoverId
			}
		}
	}

	if (oldRelease.printFileId != null) {
		data["printFile"] = {
			connect: {
				id: oldRelease.printFileId
			}
		}
	}

	let categories = await prisma.category.findMany({
		where: { releases: { some: { id: oldRelease.id } } }
	})

	for (let category of categories) {
		data.categories.connect.push({ id: category.id })
	}

	const storeBookRelease = await prisma.storeBookRelease.create({
		data
	})

	// Create the StoreBookRelease table object
	await TableObjectsController.CreateTableObject({
		accessToken,
		uuid,
		tableId: storeBookReleaseTableId
	})

	return storeBookRelease
}

export async function blurhashEncode(data: Buffer): Promise<{
	blurhash: string
	width: number
	height: number
}> {
	const getImageData = (image: Image) => {
		const canvas = createCanvas(image.width, image.height)
		const context = canvas.getContext("2d")
		context.drawImage(image, 0, 0)
		return context.getImageData(0, 0, image.width, image.height)
	}

	const image = await loadImage(data)
	const imageData = getImageData(image)

	return {
		blurhash: encode(imageData.data, imageData.width, imageData.height, 4, 4),
		width: image.width,
		height: image.height
	}
}

export async function getUserForEndpoint(accessToken: string): Promise<User> {
	if (accessToken == null) {
		return null
	}

	let userResponse = await getUser(accessToken)

	if (isSuccessStatusCode(userResponse.status)) {
		return userResponse.data
	} else if (
		userResponse.errors != null &&
		userResponse.errors.length > 0 &&
		userResponse.errors[0].code == 3101
	) {
		throwEndpointError(apiErrors.sessionEnded)
	}

	return null
}

export function getFacebookUsername(input: string): RegexResult {
	if (input == null || input == "") {
		return {
			valid: true,
			value: null
		}
	}

	let value = facebookUsernameRegex.exec(input)?.groups?.username

	return {
		valid: value != null,
		value
	}
}

export function getInstagramUsername(input: string): RegexResult {
	if (input == null || input == "") {
		return {
			valid: true,
			value: null
		}
	}

	let value = instagramUsernameRegex.exec(input)?.groups?.username

	return {
		valid: value != null,
		value
	}
}

export function getTwitterUsername(input: string): RegexResult {
	if (input == null || input == "") {
		return {
			valid: true,
			value: null
		}
	}

	let value = twitterUsernameRegex.exec(input)?.groups?.username

	return {
		valid: value != null,
		value
	}
}

export function getFilename(input: string) {
	if (input == null) return null

	return filenameRegex.exec(input)?.groups?.filename
}

export function getTableObjectFileUrl(uuid: string) {
	return `https://dav-backend.fra1.digitaloceanspaces.com/${uuid}`
}

export function getTableObjectFileCdnUrl(uuid: string) {
	return `https://dav-backend.fra1.cdn.digitaloceanspaces.com/${uuid}`
}

export function randomNumber(min: number, max: number) {
	return Math.floor(Math.random() * (max - min + 1)) + min
}

export function roundUp(num: number, precision: number = 1) {
	precision = Math.pow(10, precision)
	return Math.ceil(num * precision) / precision
}

// https://techoverflow.net/2018/04/13/convert-pt-postscript-pdf-unit-to-inch-or-mm-in-javascript/
export function convertPtToInch(pt: number): number {
	return pt / 72
}

export function stringToSlug(str: string): string {
	str = str.replace(/^\s+|\s+$/g, "") // trim
	str = str.toLowerCase()

	// remove accents, swap ñ for n, etc
	var from = "àáâèéëêìíïîòóôùúûñç·/_,:;"
	var to = "aaaeeeeiiiiooouuunc------"

	for (var i = 0, l = from.length; i < l; i++) {
		str = str.replace(new RegExp(from.charAt(i), "g"), to.charAt(i))
	}

	return str
		.replaceAll("ß", "ss") // replace ß with ss
		.replaceAll("ä", "ae") // replace ä with ae
		.replaceAll("ö", "oe") // replace ö with oe
		.replaceAll("ü", "ue") // replace ü with ue
		.replace(/[^a-z0-9 -]/g, "") // remove invalid chars
		.replace(/\s+/g, "-") // collapse whitespace and replace by -
		.replace(/-+/g, "-") // collapse dashes
}

export async function downloadFile(url: string): Promise<Buffer> {
	try {
		let response = await axios({
			method: "get",
			url,
			responseType: "arraybuffer"
		})

		return Buffer.from(response.data, "binary")
	} catch (error) {
		return null
	}
}

export function getVlbItemCoverUrl(mvbId: string): string {
	return `https://pocketlib.fra1.cdn.digitaloceanspaces.com/vlb-covers/${mvbId}.jpg`
}

export async function loadVlbItem(
	prisma: PrismaClient,
	vlbItem: VlbItemModel
): Promise<VlbItem> {
	if (vlbItem == null) return null

	// Get the full item from the API
	let item = await getProduct(vlbItem.mvbId)
	if (item == null) return null

	let identifier = item.identifiers.find(i => i.productIdentifierType == "15")
	let titleObj = item.titles.find(t => t.titleType == "01")
	let description = item.textContents?.find(t => t.textType == "03")
	let price = item.prices.find(
		p =>
			(p.priceType == "02" || p.priceType == "04") &&
			p.countriesIncluded == "DE"
	)
	let cover = item.supportingResources?.find(
		r => r.resourceContentType == "01"
	)
	let lang = item.languages?.find(l => l.languageRole == "01")

	if (vlbItem != null && titleObj != null && vlbItem.title != titleObj.title) {
		// Update the title
		vlbItem = await prisma.vlbItem.update({
			where: { id: vlbItem.id },
			data: { title: titleObj.title }
		})
	}

	return {
		__typename: "VlbItem",
		...vlbItem,
		isbn: identifier.idValue,
		description: description?.text,
		price: Math.round(price.priceAmount * 100),
		language: vlbLanguageToLanguage(lang.languageCode),
		publicationDate: item.publicationDate,
		coverUrl: cover.exportedLink
			? `${cover.exportedLink}?access_token=${process.env.VLB_COVER_TOKEN}`
			: null,
		collections: []
	}
}

export async function findVlbItemByVlbGetProductsResponseDataItem(
	prisma: PrismaClient,
	item: VlbGetProductsResponseDataItem
): Promise<VlbItem> {
	if (item == null) return null

	// Check if the VlbItem already exists
	let vlbItem = await prisma.vlbItem.findFirst({
		where: { mvbId: item.productId }
	})

	if (vlbItem != null && item.title != null && vlbItem.title != item.title) {
		// Update the title
		vlbItem = await prisma.vlbItem.update({
			where: { id: vlbItem.id },
			data: { title: item.title }
		})
	}

	if (vlbItem == null) {
		// Get the entire item data to create the VlbItem in the database
		let productItem = await getProduct(item.productId)

		if (productItem != null) {
			// Create the VlbItem
			let uuid = crypto.randomUUID()
			let slug = stringToSlug(`${item.title} ${uuid}`)

			let author = productItem.contributors?.find(
				c => c.contributorRole == "A01"
			)

			if (author != null) {
				slug = stringToSlug(
					`${author.firstName} ${author.lastName} ${item.title} ${uuid}`
				)
			}

			vlbItem = await prisma.vlbItem.create({
				data: {
					uuid,
					slug,
					mvbId: item.productId,
					title: item.title
				}
			})
		}
	}

	return {
		__typename: "VlbItem",
		...vlbItem,
		isbn: item.isbn,
		description: item.mainDescription,
		price: Math.round(item.priceEurD * 100),
		publicationDate: item.publicationDate.includes(".")
			? item.publicationDate
			: null,
		coverUrl:
			item.coverUrl != null
				? `${item.coverUrl}?access_token=${process.env.VLB_COVER_TOKEN}`
				: null,
		collections: []
	}
}

export async function findVlbItemByVlbGetCollectionResponseDataItem(
	prisma: PrismaClient,
	item: VlbGetCollectionResponseDataItem
): Promise<VlbItem> {
	return await findVlbItemByVlbGetProductsResponseDataItem(prisma, {
		productId: item.id,
		...item
	})
}

export async function findVlbAuthor(
	prisma: PrismaClient,
	author: VlbGetProductResponseDataContributor
) {
	if (author == null || author.firstName == null || author.lastName == null) {
		return null
	}

	let vlbAuthor: VlbAuthor = null

	// Check if the VlbAuthor already exists
	if (author.isni != null) {
		vlbAuthor = await prisma.vlbAuthor.findFirst({
			where: { isni: author.isni }
		})
	}

	if (vlbAuthor == null) {
		vlbAuthor = await prisma.vlbAuthor.findFirst({
			where: {
				firstName: author.firstName,
				lastName: author.lastName
			}
		})
	}

	if (vlbAuthor != null) {
		if (vlbAuthor.isni == null && author.isni != null) {
			// Add the isni to the VlbAuthor
			await prisma.vlbAuthor.update({
				where: { uuid: vlbAuthor.uuid },
				data: { isni: author.isni }
			})
		}

		if (vlbAuthor.bio == null && author.biographicalNote != null) {
			// Add the description to the VlbAuthor
			await prisma.vlbAuthor.update({
				where: { uuid: vlbAuthor.uuid },
				data: { bio: author.biographicalNote }
			})
		}
	} else {
		// Create the VlbAuthor
		let uuid = crypto.randomUUID()

		vlbAuthor = await prisma.vlbAuthor.create({
			data: {
				uuid,
				slug: stringToSlug(
					`${author.firstName} ${author.lastName} ${uuid}`
				),
				isni: author.isni,
				firstName: author.firstName,
				lastName: author.lastName,
				bio: author.biographicalNote
			}
		})
	}

	return vlbAuthor
}

export async function findVlbCollections(
	prisma: PrismaClient,
	collections: VlbGetProductResponseDataCollection[]
): Promise<VlbCollection[]> {
	let result: VlbCollection[] = []

	if (collections != null) {
		for (let collection of collections) {
			// Check if the collection is already in the result
			if (result.find(c => c.mvbId == collection.collectionId) != null) {
				continue
			}

			// Check if the collection already exists in the database
			let vlbCollection = await prisma.vlbCollection.findFirst({
				where: { mvbId: collection.collectionId }
			})

			if (vlbCollection == null) {
				// Create the VlbCollection
				let uuid = crypto.randomUUID()

				vlbCollection = await prisma.vlbCollection.create({
					data: {
						uuid,
						slug: stringToSlug(`${collection.title} ${uuid}`),
						mvbId: collection.collectionId,
						title: collection.title
					}
				})
			}

			result.push(vlbCollection)
		}
	}

	return result
}

export function vlbLanguageToLanguage(vlbLanguage: string) {
	if (vlbLanguage == "ger") {
		return "de"
	} else if (vlbLanguage == "eng") {
		return "en"
	}

	return null
}
