import { Express, Request, Response, raw } from "express"
import cors from "cors"
import { Author } from "@prisma/client"
import {
	isSuccessStatusCode,
	ApiResponse,
	TableObjectsController
} from "dav-js"
import {
	handleEndpointError,
	throwEndpointError,
	blurhashEncode,
	getUserForEndpoint,
	getTableObjectFileCdnUrl
} from "../utils.js"
import { admins, authorProfileImageTableId } from "../constants.js"
import { apiErrors } from "../errors.js"
import { validateImageContentType } from "../services/validationService.js"
import { prisma } from "../../server.js"

async function uploadAuthorProfileImage(req: Request, res: Response) {
	try {
		const uuid = req.params.uuid
		const accessToken = req.headers.authorization
		const user = await getUserForEndpoint(accessToken)

		if (user == null) {
			throwEndpointError(apiErrors.notAuthenticated)
		}

		const isAdmin = admins.includes(user.Id)

		// Check if content type is supported
		const contentType = req.headers["content-type"]
		throwEndpointError(validateImageContentType(contentType))

		let author: Author = null

		if (uuid == "mine") {
			if (isAdmin) {
				throwEndpointError(apiErrors.actionNotAllowed)
			}

			// Get the author of the user
			author = await prisma.author.findFirst({
				where: { userId: user.Id }
			})

			if (author == null) {
				throwEndpointError(apiErrors.authorDoesNotExist)
			}
		} else {
			if (!isAdmin) {
				throwEndpointError(apiErrors.actionNotAllowed)
			}

			// Get the author
			author = await prisma.author.findFirst({
				where: { uuid }
			})

			if (author == null) {
				throwEndpointError(apiErrors.authorDoesNotExist)
			}
		}

		// Get the profile image of the author
		let profileImage = await prisma.authorProfileImage.findFirst({
			where: { authorId: author.id }
		})

		let profileImageUuid: string = null
		let ext = contentType == "image/png" ? "png" : "jpg"
		let blurhash = (await blurhashEncode(req.body)).blurhash

		if (profileImage == null) {
			// Create the profile image table object
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

			// Create the profile image
			await prisma.authorProfileImage.create({
				data: {
					uuid: profileImageUuid,
					userId: user.Id,
					author: {
						connect: {
							id: author.id
						}
					},
					blurhash
				}
			})
		} else {
			profileImageUuid = profileImage.uuid

			// Update the profile image table object
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

			// Update the profile image
			await prisma.authorProfileImage.update({
				where: { id: profileImage.id },
				data: {
					blurhash
				}
			})
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

		let result = {
			uuid: profileImageUuid,
			url: getTableObjectFileCdnUrl(profileImageUuid),
			blurhash
		}

		res.status(200).json(result)
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
