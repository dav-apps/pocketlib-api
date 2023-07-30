import { Express, Request, Response, raw } from "express"
import cors from "cors"
import {
	isSuccessStatusCode,
	ApiResponse,
	TableObjectsController
} from "dav-js"
import { TableObject, PublisherLogo } from "../types.js"
import {
	handleEndpointError,
	throwEndpointError,
	blurhashEncode,
	getTableObjectFileUrl
} from "../utils.js"
import { apiErrors } from "../errors.js"
import { admins, publisherLogoTableId } from "../constants.js"
import {
	getUser,
	getTableObject,
	listTableObjects
} from "../services/apiService.js"
import { validateImageContentType } from "../services/validationService.js"

async function uploadPublisherLogo(req: Request, res: Response) {
	try {
		const uuid = req.params.uuid
		const accessToken = req.headers.authorization

		if (accessToken == null) {
			throwEndpointError(apiErrors.notAuthenticated)
		}

		const user = await getUser(accessToken)
		const isAdmin = admins.includes(user.id)

		// Check if content type is supported
		const contentType = req.headers["content-type"]
		validateImageContentType(contentType)

		let publisher: TableObject = null

		if (uuid == "mine") {
			if (isAdmin) {
				throwEndpointError(apiErrors.actionNotAllowed)
			}

			// Get the publisher of the user
			let listPublishersResponse = await listTableObjects({
				caching: false,
				limit: 1,
				tableName: "Publisher",
				userId: user.id
			})

			if (listPublishersResponse.items.length == 0) {
				throwEndpointError(apiErrors.publisherDoesNotExist)
			}

			publisher = listPublishersResponse.items[0]
		} else {
			if (!isAdmin) {
				throwEndpointError(apiErrors.actionNotAllowed)
			}

			// Get the publisher
			publisher = await getTableObject(uuid)

			if (publisher == null) {
				throwEndpointError(apiErrors.publisherDoesNotExist)
			}
		}

		// Get the logo of the publisher
		let logoUuid = publisher.properties.logo as string
		let logo: TableObject = null

		if (logoUuid != null) {
			logo = await getTableObject(logoUuid)
		}

		let ext = contentType == "image/png" ? "png" : "jpg"
		let encodeResult = await blurhashEncode(req.body)

		if (logo == null) {
			// Create a new logo table object
			let createLogoResponse =
				await TableObjectsController.CreateTableObject({
					accessToken,
					tableId: publisherLogoTableId,
					file: true,
					properties: {
						ext,
						blurhash: encodeResult.blurhash
					}
				})

			if (!isSuccessStatusCode(createLogoResponse.status)) {
				throwEndpointError(apiErrors.unexpectedError)
			}

			let createLogoResponseData = (
				createLogoResponse as ApiResponse<TableObjectsController.TableObjectResponseData>
			).data

			logoUuid = createLogoResponseData.tableObject.Uuid
		} else {
			// Update the existing logo table object
			let updateLogoResponse =
				await TableObjectsController.UpdateTableObject({
					accessToken,
					uuid: logoUuid,
					properties: {
						ext,
						blurhash: encodeResult.blurhash
					}
				})

			if (!isSuccessStatusCode(updateLogoResponse.status)) {
				throwEndpointError(apiErrors.unexpectedError)
			}
		}

		// Upload the data
		let setTableObjectFileResponse =
			await TableObjectsController.SetTableObjectFile({
				accessToken,
				uuid: logoUuid,
				data: req.body,
				type: contentType
			})

		if (!isSuccessStatusCode(setTableObjectFileResponse.status)) {
			throwEndpointError(apiErrors.unexpectedError)
		}

		let result: PublisherLogo = {
			uuid: logoUuid,
			url: getTableObjectFileUrl(logoUuid),
			blurhash: encodeResult.blurhash
		}

		res.status(200).json(result)
	} catch (error) {
		handleEndpointError(res, error)
	}
}

export function setup(app: Express) {
	app.put(
		"/publishers/:uuid/logo",
		raw({ type: "*/*", limit: "100mb" }),
		cors(),
		uploadPublisherLogo
	)
}
