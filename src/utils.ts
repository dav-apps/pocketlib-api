import { Response } from "express"
import { GraphQLError } from "graphql"
import { encode } from "blurhash"
import { createCanvas, loadImage, Image } from "canvas"
import * as crypto from "crypto"
import { PrismaClient, StoreBookRelease } from "@prisma/client"
import { TableObjectsController, isSuccessStatusCode } from "dav-js"
import { RegexResult, ApiError, User, StoreBook } from "./types.js"
import {
	storeBookReleaseTableId,
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
}

export async function getLastReleaseOfStoreBook(
	prisma: PrismaClient,
	storeBookId: bigint,
	published: boolean = false
): Promise<StoreBookRelease> {
	if (published) {
		let release = await prisma.storeBookRelease.findFirst({
			where: { storeBookId: storeBookId, status: "published" },
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
	return `https://dav-backend.fra1.cdn.digitaloceanspaces.com/${uuid}`
}

export function randomNumber(min: number, max: number) {
	return Math.floor(Math.random() * (max - min + 1)) + min
}
