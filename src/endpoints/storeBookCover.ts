import { Express, Request, Response, raw } from "express"
import cors from "cors"
import {
	isSuccessStatusCode,
	ApiResponse,
	TableObjectsController
} from "dav-js"
import { StoreBookCover } from "../types.js"
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
import { getTableObject } from "../services/apiService.js"
import { validateImageContentType } from "../services/validationService.js"

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
		let storeBook = await getTableObject(uuid)

		// Check if the store book belongs to the user
		if (storeBook.userId != user.id) {
			throwEndpointError(apiErrors.actionNotAllowed)
		}

		// Get the latest release of the store book
		let release = await getLastReleaseOfStoreBook(storeBook)

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

		if (release.properties.status == "published") {
			// Create a new release
			let createReleaseResponse = await createNewStoreBookRelease(
				accessToken,
				storeBook,
				release
			)

			if (!isSuccessStatusCode(createReleaseResponse.status)) {
				throwEndpointError(apiErrors.unexpectedError)
			}

			let createReleaseResponseData = (
				createReleaseResponse as ApiResponse<TableObjectsController.TableObjectResponseData>
			).data

			// Add the new release to the releases of the store book
			let releaseUuidsString = storeBook.properties.releases as string
			releaseUuidsString += `,${createReleaseResponseData.tableObject.Uuid}`

			let updateStoreBookResponse =
				await TableObjectsController.UpdateTableObject({
					accessToken,
					uuid: storeBook.uuid,
					properties: {
						releases: releaseUuidsString
					}
				})

			if (!isSuccessStatusCode(updateStoreBookResponse.status)) {
				throwEndpointError(apiErrors.unexpectedError)
			}

			// Update the release object with the data of the new release
			release = {
				uuid: createReleaseResponseData.tableObject.Uuid,
				userId: user.id,
				tableId: createReleaseResponseData.tableObject.TableId,
				properties: {}
			}

			for (let key of Object.keys(
				createReleaseResponseData.tableObject.Properties
			)) {
				let value = createReleaseResponseData.tableObject.Properties[key]
				release.properties[key] = value.value
			}

			// Create a new StoreBookCover & update the release
			coverUuid = await createCover(
				accessToken,
				release.uuid,
				req.body,
				contentType,
				ext,
				encodeResult.blurhash,
				aspectRatio
			)
		} else {
			// Check if the release already has a cover
			if (release.properties.cover == null) {
				// Create a new StoreBookCover & update the release
				coverUuid = await createCover(
					accessToken,
					release.uuid,
					req.body,
					contentType,
					ext,
					encodeResult.blurhash,
					aspectRatio
				)
			} else {
				// Update the existing cover table object
				coverUuid = release.properties.cover as string

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

		let result: StoreBookCover = {
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
	accessToken: string,
	releaseUuid: string,
	data: any,
	contentType: string,
	ext: string,
	blurhash: string,
	aspectRatio: string
) {
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

	// Update the release with the new cover
	let updateReleaseResponse = await TableObjectsController.UpdateTableObject({
		accessToken,
		uuid: releaseUuid,
		properties: {
			cover: createCoverResponseData.tableObject.Uuid
		}
	})

	if (!isSuccessStatusCode(updateReleaseResponse.status)) {
		throwEndpointError(apiErrors.unexpectedError)
	}

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
