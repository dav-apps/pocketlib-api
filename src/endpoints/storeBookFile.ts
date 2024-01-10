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
	getUserForEndpoint,
	getFilename
} from "../utils.js"
import { storeBookFileTableId } from "../constants.js"
import { apiErrors } from "../errors.js"
import { validateEbookContentType } from "../services/validationService.js"
import { prisma } from "../../server.js"

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
		let storeBook = (await prisma.storeBook.findFirst({
			where: { uuid }
		})) as StoreBook

		if (storeBook == null) {
			throwEndpointError(apiErrors.storeBookDoesNotExist)
		}

		// Check if the store book belongs to the user
		if (storeBook.userId != BigInt(user.id)) {
			throwEndpointError(apiErrors.actionNotAllowed)
		}

		// Get the latest release of the store book
		let release = await getLastReleaseOfStoreBook(prisma, storeBook.id, false)

		if (release == null) {
			throwEndpointError(apiErrors.unexpectedError)
		}

		// Get the new file name
		let fileUuid = null
		let ext = contentType == "application/pdf" ? "pdf" : "epub"
		let contentDisposition = req.headers["content-disposition"]
		let fileName = getFilename(contentDisposition)
		if (fileName != null) fileName = decodeURI(fileName)

		if (release.status == "published") {
			// Create a new release
			let newRelease = await createNewStoreBookRelease(
				prisma,
				storeBook,
				release,
				user.id
			)

			// Create a new StoreBookFile & update the release
			fileUuid = await createFile(
				prisma,
				accessToken,
				BigInt(user.id),
				newRelease.id,
				req.body,
				contentType,
				ext,
				fileName
			)
		} else {
			// Check if the release already has a file
			if (release.fileId == null) {
				// Create a new StoreBookFile & update the release
				fileUuid = await createFile(
					prisma,
					accessToken,
					BigInt(user.id),
					release.id,
					req.body,
					contentType,
					ext,
					fileName
				)
			} else {
				// Update the existing file
				let file = await prisma.storeBookFile.update({
					where: { id: release.fileId },
					data: {
						fileName
					}
				})

				fileUuid = file.uuid

				// Update the existing file table object
				let updateFileResponse =
					await TableObjectsController.UpdateTableObject({
						accessToken,
						uuid: fileUuid,
						properties: {
							ext,
							file_name: fileName
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

		let result = {
			uuid: fileUuid,
			fileName
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
	prisma: PrismaClient,
	accessToken: string,
	userId: bigint,
	releaseId: bigint,
	data: any,
	contentType: string,
	ext: string,
	fileName: string
) {
	// Create the file table object
	let createFileResponse = await TableObjectsController.CreateTableObject({
		accessToken,
		tableId: storeBookFileTableId,
		file: true,
		properties: {
			ext,
			file_name: fileName
		}
	})

	if (!isSuccessStatusCode(createFileResponse.status)) {
		throwEndpointError(apiErrors.unexpectedError)
	}

	let createFileResponseData = (
		createFileResponse as ApiResponse<TableObjectsController.TableObjectResponseData>
	).data

	const fileUuid = createFileResponseData.tableObject.Uuid

	// Create the file
	await prisma.storeBookFile.create({
		data: {
			uuid: fileUuid,
			userId,
			releases: {
				connect: [{ id: releaseId }]
			},
			fileName
		}
	})

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
