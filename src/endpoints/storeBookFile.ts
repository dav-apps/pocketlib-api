import { Express, Request, Response, raw } from "express"
import cors from "cors"
import {
	isSuccessStatusCode,
	ApiResponse,
	TableObjectsController
} from "dav-js"
import { StoreBookFile } from "../types.js"
import {
	handleEndpointError,
	throwEndpointError,
	getLastReleaseOfStoreBook,
	createNewStoreBookRelease,
	getUserForEndpoint,
	getFilename
} from "../utils.js"
import { storeBookFileTableId } from "../constants.js"
import { apiErrors } from "../errors.js"
import { getTableObject } from "../services/apiService.js"
import { validateEbookContentType } from "../services/validationService.js"

export async function uploadStoreBookFile(req: Request, res: Response) {
	try {
		const uuid = req.params.uuid
		const accessToken = req.headers.authorization
		const user = await getUserForEndpoint(accessToken)

		if (user == null) {
			throwEndpointError(apiErrors.notAuthenticated)
		}

		// Check if content type is supported
		const contentType = req.headers["content-type"]
		validateEbookContentType(contentType)

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

		// Get the new file name
		let fileUuid = null
		let ext = contentType == "application/pdf" ? "pdf" : "epub"
		let contentDisposition = req.headers["content-disposition"]
		let filename = getFilename(contentDisposition)

		if (release.properties.status == "published") {
			// Create a new release
			let createReleaseResponse = await createNewStoreBookRelease(
				accessToken,
				storeBook,
				release
			)

			if (!isSuccessStatusCode) {
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
						reeases: releaseUuidsString
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

			// Create a new StoreBookFile & update the release
			fileUuid = await createFile(
				accessToken,
				release.uuid,
				req.body,
				contentType,
				ext,
				filename
			)
		} else {
			// Check if the release already has a cover
			if (release.properties.file == null) {
				// Create a new StoreBookFile & update the release
				fileUuid = await createFile(
					accessToken,
					release.uuid,
					req.body,
					contentType,
					ext,
					filename
				)
			} else {
				// Update the existing file table object
				fileUuid = release.properties.file as string

				let updateFileResponse =
					await TableObjectsController.UpdateTableObject({
						accessToken,
						uuid: fileUuid,
						properties: {
							ext,
							file_name: filename
						}
					})

				if (!isSuccessStatusCode(updateFileResponse.status)) {
					throwEndpointError(apiErrors.unexpectedError)
				}

				// Upload the data
				let setTableObjectFileResponse =
					await TableObjectsController.SetTableObjectFile({
						accessToken,
						uuid: fileUuid,
						data: req.body,
						type: contentType
					})

				if (!isSuccessStatusCode(setTableObjectFileResponse.status)) {
					throwEndpointError(apiErrors.unexpectedError)
				}
			}
		}

		let result: StoreBookFile = {
			uuid: fileUuid,
			fileName: filename
		}

		res.status(200).json(result)
	} catch (error) {
		handleEndpointError(res, error)
	}
}

export function setup(app: Express) {
	app.put(
		"/storeBooks/:uuid/file",
		raw({ type: "*/*", limit: "100mb" }),
		cors(),
		uploadStoreBookFile
	)
}

//#region Helper function
async function createFile(
	accessToken: string,
	releaseUuid: string,
	data: any,
	contentType: string,
	ext: string,
	filename: string
) {
	let createFileResponse = await TableObjectsController.CreateTableObject({
		accessToken,
		tableId: storeBookFileTableId,
		file: true,
		properties: {
			ext,
			file_name: filename
		}
	})

	if (!isSuccessStatusCode(createFileResponse.status)) {
		throwEndpointError(apiErrors.unexpectedError)
	}

	let createFileResponseData = (
		createFileResponse as ApiResponse<TableObjectsController.TableObjectResponseData>
	).data

	const fileUuid = createFileResponseData.tableObject.Uuid

	// Update the release with the new file
	let updateReleaseResponse = await TableObjectsController.UpdateTableObject({
		accessToken,
		uuid: releaseUuid,
		properties: {
			file: createFileResponseData.tableObject.Uuid
		}
	})

	if (!isSuccessStatusCode(updateReleaseResponse.status)) {
		throwEndpointError(apiErrors.unexpectedError)
	}

	// Upload the data
	let setTableObjectFileResponse =
		await TableObjectsController.SetTableObjectFile({
			accessToken,
			uuid: fileUuid,
			data,
			type: contentType
		})

	if (!isSuccessStatusCode(setTableObjectFileResponse.status)) {
		throwEndpointError(apiErrors.unexpectedError)
	}

	return fileUuid
}
//#endregion
