import { Express, Request, Response, raw } from "express"
import cors from "cors"
import {
	isSuccessStatusCode,
	ApiResponse,
	TableObjectsController
} from "dav-js"
import { TableObject } from "../types.js"
import {
	handleEndpointError,
	throwEndpointError,
	blurhashEncode,
	getUserForEndpoint,
	getTableObjectFileUrl
} from "../utils.js"
import { admins, authorProfileImageTableId } from "../constants.js"
import { apiErrors } from "../errors.js"
import { getTableObject, listTableObjects } from "../services/apiService.js"
import { validateImageContentType } from "../services/validationService.js"

async function uploadAuthorProfileImage(req: Request, res: Response) {
	try {
		const uuid = req.params.uuid
		const accessToken = req.headers.authorization
		const user = await getUserForEndpoint(accessToken)

		if (user == null) {
			throwEndpointError(apiErrors.notAuthenticated)
		}

		const isAdmin = admins.includes(user.id)

		// Check if content type is supported
		const contentType = req.headers["content-type"]
		validateImageContentType(contentType)

		let author: TableObject = null

		if (uuid == "mine") {
			if (isAdmin) {
				throwEndpointError(apiErrors.actionNotAllowed)
			}

			// Get the author of the user
			let listAuthorsResponse = await listTableObjects({
				caching: false,
				limit: 1,
				tableName: "Author",
				userId: user.id
			})

			if (listAuthorsResponse.items.length == 0) {
				throwEndpointError(apiErrors.authorDoesNotExist)
			}

			author = listAuthorsResponse.items[0]
		} else {
			if (!isAdmin) {
				throwEndpointError(apiErrors.actionNotAllowed)
			}

			// Get the author
			author = await getTableObject(uuid)

			if (author == null) {
				throwEndpointError(apiErrors.authorDoesNotExist)
			}
		}

		// Get the profile image of the author
		let profileImageUuid = author.properties.profile_image as string
		let profileImage: TableObject = null
		let result = null

		if (profileImageUuid != null) {
			profileImage = await getTableObject(profileImageUuid)
		}

		let ext = contentType == "image/png" ? "png" : "jpg"
		let blurhash = (await blurhashEncode(req.body)).blurhash

		if (profileImage == null) {
			// Create a new profile image table object
			let createProfileImageResponse =
				await TableObjectsController.CreateTableObject({
					accessToken,
					tableId: authorProfileImageTableId,
					file: true,
					properties: {
						ext,
						blurhash
					}
				})

			if (!isSuccessStatusCode(createProfileImageResponse.status)) {
				throwEndpointError(apiErrors.unexpectedError)
			}

			let createProfileImageResponseData = (
				createProfileImageResponse as ApiResponse<TableObjectsController.TableObjectResponseData>
			).data

			profileImageUuid = createProfileImageResponseData.tableObject.Uuid
		} else {
			// Update the existing profile image table object
			let updateProfileImageResponse =
				await TableObjectsController.UpdateTableObject({
					accessToken,
					uuid: profileImageUuid,
					properties: {
						ext,
						blurhash
					}
				})

			if (!isSuccessStatusCode(updateProfileImageResponse.status)) {
				throwEndpointError(apiErrors.unexpectedError)
			}
		}

		// Upload the data
		let setTableObjectFileResponse =
			await TableObjectsController.SetTableObjectFile({
				accessToken,
				uuid: profileImageUuid,
				data: req.body,
				type: contentType
			})

		if (!isSuccessStatusCode(setTableObjectFileResponse.status)) {
			throwEndpointError(apiErrors.unexpectedError)
		}

		result = {
			uuid: profileImageUuid,
			url: getTableObjectFileUrl(profileImageUuid),
			blurhash
		}

		res.status(201).json(result)
	} catch (error) {
		handleEndpointError(res, error)
	}
}

export function setup(app: Express) {
	app.put(
		"/authors/:uuid/profileImage",
		raw({ type: "*/*", limit: "100mb" }),
		cors(),
		uploadAuthorProfileImage
	)
}
