import { Express, Request, Response, raw } from "express"
import cors from "cors"
import { Publisher } from "@prisma/client"
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
import { apiErrors } from "../errors.js"
import { admins, publisherLogoTableId } from "../constants.js"
import { validateImageContentType } from "../services/validationService.js"
import { prisma } from "../../server.js"

async function uploadPublisherLogo(req: Request, res: Response) {
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
		throwEndpointError(validateImageContentType(contentType))

		let publisher: Publisher = null

		if (uuid == "mine") {
			if (isAdmin) {
				throwEndpointError(apiErrors.actionNotAllowed)
			}

			// Get the publisher of the user
			publisher = await prisma.publisher.findFirst({
				where: { userId: user.id }
			})

			if (publisher == null) {
				throwEndpointError(apiErrors.publisherDoesNotExist)
			}
		} else {
			if (!isAdmin) {
				throwEndpointError(apiErrors.actionNotAllowed)
			}

			// Get the publisher
			publisher = await prisma.publisher.findFirst({
				where: { uuid }
			})

			if (publisher == null) {
				throwEndpointError(apiErrors.publisherDoesNotExist)
			}
		}

		// Get the logo of the publisher
		let logo = await prisma.publisherLogo.findFirst({
			where: { publisherId: publisher.id }
		})

		let logoUuid: string = null
		let ext = contentType == "image/png" ? "png" : "jpg"
		let blurhash = (await blurhashEncode(req.body)).blurhash

		if (logo == null) {
			// Create the logo table object
			let createLogoResponse =
				await TableObjectsController.CreateTableObject({
					accessToken,
					tableId: publisherLogoTableId,
					file: true,
					properties: {
						ext,
						blurhash
					}
				})

			if (!isSuccessStatusCode(createLogoResponse.status)) {
				throwEndpointError(apiErrors.unexpectedError)
			}

			let createLogoResponseData = (
				createLogoResponse as ApiResponse<TableObjectsController.TableObjectResponseData>
			).data

			logoUuid = createLogoResponseData.tableObject.Uuid

			// Create the logo
			await prisma.publisherLogo.create({
				data: {
					uuid: logoUuid,
					userId: user.id,
					publisher: {
						connect: {
							id: publisher.id
						}
					},
					blurhash
				}
			})
		} else {
			logoUuid = logo.uuid

			// Update the logo table object
			let updateLogoResponse =
				await TableObjectsController.UpdateTableObject({
					accessToken,
					uuid: logoUuid,
					properties: {
						ext,
						blurhash
					}
				})

			if (!isSuccessStatusCode(updateLogoResponse.status)) {
				throwEndpointError(apiErrors.unexpectedError)
			}

			// Update the logo
			await prisma.publisherLogo.update({
				where: { id: logo.id },
				data: {
					blurhash
				}
			})
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

		let result = {
			uuid: logoUuid,
			url: getTableObjectFileCdnUrl(logoUuid),
			blurhash
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
