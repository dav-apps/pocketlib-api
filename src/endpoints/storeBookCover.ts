import { Express, Request, Response, raw } from "express"
import cors from "cors"
import { PrismaClient } from "@prisma/client"
import {
	isSuccessStatusCode,
	ApiResponse,
	TableObjectsController
} from "dav-js"
import { StoreBook } from "../types.js"
import {
	handleEndpointError,
	throwEndpointError,
	getLastReleaseOfStoreBook,
	createNewStoreBookRelease,
	blurhashEncode,
	getUserForEndpoint,
	getTableObjectFileUrl
} from "../utils.js"
import { storeBookCoverTableId } from "../constants.js"
import { apiErrors } from "../errors.js"
import { validateImageContentType } from "../services/validationService.js"
import { prisma } from "../../server.js"

export async function uploadStoreBookCover(req: Request, res: Response) {
	try {
		const uuid = req.params.uuid
		const accessToken = req.headers.authorization
		const user = await getUserForEndpoint(accessToken)

		if (user == null) {
			throwEndpointError(apiErrors.notAuthenticated)
		}

		// Check if content type is supported
		const contentType = req.headers["content-type"]
		validateImageContentType(contentType)

		// Get the store book
		let storeBook = (await prisma.storeBook.findFirst({
			where: { uuid }
		})) as StoreBook

		// Check if the store book belongs to the user
		if (storeBook.userId != BigInt(user.id)) {
			throwEndpointError(apiErrors.actionNotAllowed)
		}

		// Get the latest release of the store book
		let release = await getLastReleaseOfStoreBook(prisma, storeBook, false)

		if (release == null) {
			throwEndpointError(apiErrors.unexpectedError)
		}

		// Calculate the new blurhash and aspect ratio
		let coverUuid = null
		let ext = contentType == "image/png" ? "png" : "jpg"
		let encodeResult = await blurhashEncode(req.body)
		let aspectRatio = "1:1"

		if (encodeResult.width < encodeResult.height) {
			let value = (encodeResult.height / encodeResult.width).toFixed(5)
			aspectRatio = `1:${value}`
		} else if (encodeResult.width > encodeResult.height) {
			let value = (encodeResult.width / encodeResult.height).toFixed(5)
			aspectRatio = `${value}:1`
		}

		if (release.status == "published") {
			// Create a new release
			let newRelease = await createNewStoreBookRelease(
				prisma,
				storeBook,
				release,
				user.id
			)

			// Create a new StoreBookCover & update the release
			coverUuid = await createCover(
				prisma,
				accessToken,
				newRelease.id,
				req.body,
				contentType,
				ext,
				encodeResult.blurhash,
				aspectRatio
			)
		} else {
			// Check if the release already has a cover
			if (release.coverId == null) {
				// Create a new StoreBookCover & update the release
				coverUuid = await createCover(
					prisma,
					accessToken,
					release.id,
					req.body,
					contentType,
					ext,
					encodeResult.blurhash,
					aspectRatio
				)
			} else {
				// Update the existing cover
				let cover = await prisma.storeBookCover.update({
					where: { id: release.coverId },
					data: {
						blurhash: encodeResult.blurhash,
						aspectRatio
					}
				})

				coverUuid = cover.uuid

				// Update the existing cover table object
				let updateCoverResponse =
					await TableObjectsController.UpdateTableObject({
						accessToken,
						uuid: coverUuid,
						properties: {
							ext,
							blurhash: encodeResult.blurhash,
							aspect_ratio: aspectRatio
						}
					})

				if (!isSuccessStatusCode(updateCoverResponse.status)) {
					throwEndpointError(apiErrors.unexpectedError)
				}

				// Upload the data
				let setTableObjectFileResponse =
					await TableObjectsController.SetTableObjectFile({
						accessToken,
						uuid: coverUuid,
						data: req.body,
						type: contentType
					})

				if (!isSuccessStatusCode(setTableObjectFileResponse.status)) {
					throwEndpointError(apiErrors.unexpectedError)
				}
			}
		}

		let result = {
			uuid: coverUuid,
			url: getTableObjectFileUrl(coverUuid),
			aspectRatio: aspectRatio,
			blurhash: encodeResult.blurhash
		}

		res.status(200).json(result)
	} catch (error) {
		handleEndpointError(res, error)
	}
}

export function setup(app: Express) {
	app.put(
		"/storeBooks/:uuid/cover",
		raw({ type: "*/*", limit: "100mb" }),
		cors(),
		uploadStoreBookCover
	)
}

//#region Helper functions
async function createCover(
	prisma: PrismaClient,
	accessToken: string,
	releaseId: bigint,
	data: any,
	contentType: string,
	ext: string,
	blurhash: string,
	aspectRatio: string
) {
	// Create the cover table object
	let createCoverResponse = await TableObjectsController.CreateTableObject({
		accessToken,
		tableId: storeBookCoverTableId,
		file: true,
		properties: {
			ext,
			blurhash,
			aspect_ratio: aspectRatio
		}
	})

	if (!isSuccessStatusCode(createCoverResponse.status)) {
		throwEndpointError(apiErrors.unexpectedError)
	}

	let createCoverResponseData = (
		createCoverResponse as ApiResponse<TableObjectsController.TableObjectResponseData>
	).data

	const coverUuid = createCoverResponseData.tableObject.Uuid

	// Create the cover
	await prisma.storeBookCover.create({
		data: {
			uuid: coverUuid,
			releases: {
				connect: [{ id: releaseId }]
			},
			blurhash,
			aspectRatio
		}
	})

	// Upload the data
	let setTableObjectFileResponse =
		await TableObjectsController.SetTableObjectFile({
			accessToken,
			uuid: coverUuid,
			data,
			type: contentType
		})

	if (!isSuccessStatusCode(setTableObjectFileResponse.status)) {
		throwEndpointError(apiErrors.unexpectedError)
	}

	return coverUuid
}
//#endregion
