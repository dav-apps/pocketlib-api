import { Response } from "express"
import { GraphQLError } from "graphql"
import { encode } from "blurhash"
import { createCanvas, loadImage, Image } from "canvas"
import * as crypto from "crypto"
import { PrismaClient, StoreBookRelease } from "@prisma/client"
import { isSuccessStatusCode } from "dav-js"
import {
	ApiError,
	User,
	TableObject,
	Publisher,
	PublisherLogo,
	Author,
	StoreBookCollection,
	StoreBookCollectionName,
	StoreBookSeries,
	StoreBook,
	StoreBookCover,
	StoreBookFile,
	Category,
	CategoryName
} from "./types.js"
import {
	facebookUsernameRegex,
	instagramUsernameRegex,
	twitterUsernameRegex,
	filenameRegex
} from "./constants.js"
import { apiErrors } from "./errors.js"
import { getUser } from "./services/apiService.js"

export function throwApiError(error: ApiError) {
	throw new GraphQLError(error.message, {
		extensions: {
			code: error.code
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
	const release = await getLastReleaseOfStoreBook(prisma, storeBook, published)
	if (release == null) return

	storeBook.title = release.title
	storeBook.description = release.description
	storeBook.price = release.price
	storeBook.isbn = release.isbn
}

export async function getLastReleaseOfStoreBook(
	prisma: PrismaClient,
	storeBook: StoreBook,
	published: boolean = false
): Promise<StoreBookRelease> {
	if (published) {
		return await prisma.storeBookRelease.findFirst({
			where: { storeBookId: storeBook.id, status: "published" },
			orderBy: {
				publishedAt: "desc"
			}
		})
	}

	return await prisma.storeBookRelease.findFirst({
		where: { storeBookId: storeBook.id },
		orderBy: { id: "desc" }
	})
}

export async function createNewStoreBookRelease(
	prisma: PrismaClient,
	storeBook: StoreBook,
	oldRelease: StoreBookRelease
): Promise<StoreBookRelease> {
	let data = {
		uuid: crypto.randomUUID(),
		storeBook: {
			connect: {
				id: storeBook.id
			}
		},
		title: oldRelease.title,
		description: oldRelease.description,
		price: oldRelease.price,
		isbn: oldRelease.isbn,
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

	let categories = await prisma.category.findMany({
		where: { releases: { some: { id: oldRelease.id } } }
	})

	for (let category of categories) {
		data.categories.connect.push({ id: category.id })
	}

	return await prisma.storeBookRelease.create({
		data
	})
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

export function getFacebookUsername(input: string) {
	if (input == null) return null

	return facebookUsernameRegex.exec(input)?.groups?.username
}

export function getInstagramUsername(input: string) {
	if (input == null) return null

	return instagramUsernameRegex.exec(input)?.groups?.username
}

export function getTwitterUsername(input: string) {
	if (input == null) return null

	return twitterUsernameRegex.exec(input)?.groups?.username
}

export function getFilename(input: string) {
	if (input == null) return null

	return filenameRegex.exec(input)?.groups?.filename
}

export function getTableObjectFileUrl(uuid: string) {
	return `https://dav-backend.fra1.cdn.digitaloceanspaces.com/${uuid}`
}

//#region Converter functions
export function convertTableObjectToPublisher(obj: TableObject): Publisher {
	return {
		uuid: obj.uuid,
		name: obj.properties.name as string,
		description: obj.properties.description as string,
		websiteUrl: obj.properties.website_url as string,
		facebookUsername: obj.properties.facebook_username as string,
		instagramUsername: obj.properties.instagram_username as string,
		twitterUsername: obj.properties.twitter_username as string,
		logo: obj.properties.logo as string,
		authors: obj.properties.authors as string
	}
}

export function convertTableObjectToPublisherLogo(
	obj: TableObject
): PublisherLogo {
	return {
		uuid: obj.uuid,
		url: getTableObjectFileUrl(obj.uuid),
		blurhash: obj.properties.blurhash as string
	}
}

export function convertTableObjectToAuthor(obj: TableObject): Author {
	return {
		uuid: obj.uuid,
		publisher: obj.properties.publisher as string,
		firstName: obj.properties.first_name as string,
		lastName: obj.properties.last_name as string,
		websiteUrl: obj.properties.website_url as string,
		facebookUsername: obj.properties.facebook_username as string,
		instagramUsername: obj.properties.instagram_username as string,
		twitterUsername: obj.properties.twitter_username as string,
		profileImage: obj.properties.profile_image as string,
		bios: obj.properties.bios as string,
		collections: obj.properties.collections as string,
		series: obj.properties.series as string
	}
}

export function convertTableObjectToAuthorBio(obj: TableObject): AuthorBio {
	return {
		uuid: obj.uuid,
		bio: obj.properties.bio as string,
		language: obj.properties.language as string
	}
}

export function convertTableObjectToAuthorProfileImage(
	obj: TableObject
): AuthorProfileImage {
	return {
		uuid: obj.uuid,
		url: getTableObjectFileUrl(obj.uuid),
		blurhash: obj.properties.blurhash as string
	}
}

export function convertTableObjectToStoreBookCollection(
	obj: TableObject
): StoreBookCollection {
	return {
		uuid: obj.uuid,
		author: obj.properties.author as string,
		names: obj.properties.names as string,
		storeBooks: obj.properties.books as string
	}
}

export function convertTableObjectToStoreBookCollectionName(
	obj: TableObject
): StoreBookCollectionName {
	return {
		uuid: obj.uuid,
		name: obj.properties.name as string,
		language: obj.properties.language as string
	}
}

export function convertTableObjectToStoreBookSeries(
	obj: TableObject
): StoreBookSeries {
	return {
		uuid: obj.uuid,
		author: obj.properties.author as string,
		name: obj.properties.name as string,
		language: obj.properties.language as string,
		storeBooks: obj.properties.store_books as string
	}
}

export function convertTableObjectToStoreBook(obj: TableObject): StoreBook {
	return {
		uuid: obj.uuid,
		collection: obj.properties.collection as string,
		title: null,
		description: null,
		language: obj.properties.language as string,
		price: null,
		isbn: null,
		status: (obj.properties.status as string) || "unpublished",
		cover: null,
		file: null,
		categories: null,
		releases: obj.properties.releases as string,
		inLibrary: null,
		purchased: null
	}
}

export function convertTableObjectToStoreBookRelease(
	obj: TableObject
): StoreBookRelease {
	return {
		uuid: obj.uuid,
		storeBook: obj.properties.store_book as string,
		releaseName: obj.properties.release_name as string,
		releaseNotes: obj.properties.release_notes as string,
		publishedAt: obj.properties.published_at as string,
		title: obj.properties.title as string,
		description: obj.properties.description as string,
		price: obj.properties.price as number,
		isbn: obj.properties.isbn as string,
		status: (obj.properties.status as string) || "unpublished",
		cover: obj.properties.cover as string,
		file: obj.properties.file as string,
		categories: obj.properties.categories as string
	}
}

export function convertTableObjectToStoreBookCover(
	obj: TableObject
): StoreBookCover {
	return {
		uuid: obj.uuid,
		url: getTableObjectFileUrl(obj.uuid),
		aspectRatio: obj.properties.aspect_ratio as string,
		blurhash: obj.properties.blurhash as string
	}
}

export function convertTableObjectToStoreBookFile(
	obj: TableObject
): StoreBookFile {
	return {
		uuid: obj.uuid,
		fileName: obj.properties.file_name as string
	}
}

export function convertTableObjectToCategory(obj: TableObject): Category {
	return {
		uuid: obj.uuid,
		key: obj.properties.key as string,
		names: obj.properties.names as string
	}
}

export function convertTableObjectToCategoryName(
	obj: TableObject
): CategoryName {
	return {
		uuid: obj.uuid,
		name: obj.properties.name as string,
		language: obj.properties.language as string
	}
}
//#endregion
