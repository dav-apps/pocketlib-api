import { Response } from "express"
import { GraphQLError } from "graphql"
import { encode } from "blurhash"
import { createCanvas, loadImage, Image } from "canvas"
import { ApiResponse, ApiErrorResponse, TableObjectsController } from "dav-js"
import {
	ApiError,
	TableObject,
	Publisher,
	PublisherLogo,
	Author,
	AuthorBio,
	AuthorProfileImage,
	StoreBookCollection,
	StoreBookCollectionName,
	StoreBookSeries,
	StoreBook,
	StoreBookRelease,
	StoreBookCover,
	StoreBookFile,
	Category,
	CategoryName
} from "./types.js"
import {
	storeBookReleaseTableId,
	facebookUsernameRegex,
	instagramUsernameRegex,
	twitterUsernameRegex
} from "./constants.js"
import { apiErrors } from "./errors.js"
import { getTableObject } from "./services/apiService.js"

export function throwApiError(error: ApiError) {
	throw new GraphQLError(error.message, {
		extensions: {
			code: error.code,
			http: { status: error.status || 500 }
		}
	})
}

export function throwValidationError(...errors: string[]) {
	let filteredErrors = errors.filter(e => e != null)

	if (filteredErrors.length > 0) {
		throw new GraphQLError(apiErrors.validationFailed.message, {
			extensions: {
				code: apiErrors.validationFailed.code,
				http: { status: apiErrors.validationFailed.status || 500 },
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
	storeBook: StoreBook,
	published: boolean = true
) {
	// Get the latest release of the StoreBook
	const releasesString = storeBook.releases

	if (releasesString != null) {
		let releaseUuids = releasesString.split(",").reverse()
		let releases: StoreBookRelease[] = []
		let releaseFound = false

		for (let uuid of releaseUuids) {
			let releaseTableObject = await getTableObject(uuid)
			if (releaseTableObject == null) continue

			let release = convertTableObjectToStoreBookRelease(releaseTableObject)
			releases.push(release)

			if (!published || (published && release.status == "published")) {
				storeBook.title = release.title
				storeBook.description = release.description
				storeBook.price = release.price || 0
				storeBook.isbn = release.isbn
				storeBook.cover = release.cover
				storeBook.file = release.file
				storeBook.categories = release.categories

				releaseFound = true
				break
			}
		}

		if (!releaseFound && releases.length > 0) {
			// Retrieve the data of the first release
			let release = releases[0]

			storeBook.title = release.title
			storeBook.description = release.description
			storeBook.price = release.price || 0
			storeBook.isbn = release.isbn
			storeBook.cover = release.cover
			storeBook.file = release.file
			storeBook.categories = release.categories
		}
	}
}

export async function getLastReleaseOfStoreBook(
	storeBook: TableObject,
	published: boolean = false
): Promise<TableObject> {
	let releaseUuidsString = storeBook.properties.releases as string
	let releaseUuids = releaseUuidsString.split(",").reverse()
	if (releaseUuidsString.length == 0) return null

	if (published) {
		for (let releaseUuid of releaseUuids) {
			let release = await getTableObject(releaseUuid)

			if (release.properties.status == "published") {
				return release
			}
		}
	}

	return await getTableObject(releaseUuids[0])
}

export async function createNewStoreBookRelease(
	accessToken: string,
	storeBook: TableObject,
	oldRelease: TableObject
): Promise<
	| ApiResponse<TableObjectsController.TableObjectResponseData>
	| ApiErrorResponse
> {
	return await TableObjectsController.CreateTableObject({
		accessToken,
		tableId: storeBookReleaseTableId,
		properties: {
			store_book: storeBook.uuid,
			title: oldRelease.properties.title,
			description: oldRelease.properties.description,
			price: oldRelease.properties.price,
			isbn: oldRelease.properties.isbn,
			cover_item: oldRelease.properties.cover_item,
			file_item: oldRelease.properties.file_item,
			categories: oldRelease.properties.categories
		}
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
