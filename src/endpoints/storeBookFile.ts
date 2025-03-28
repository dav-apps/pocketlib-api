import { Express, Request, Response, raw } from "express"
import cors from "cors"
import { PrismaClient } from "@prisma/client"
import {
	isSuccessStatusCode,
	TableObjectsController,
	TableObjectResource
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
		throwEndpointError(validateEbookContentType(contentType))

		// Get the store book
		let storeBook = (await prisma.storeBook.findFirst({
			where: { uuid }
		})) as StoreBook

		if (storeBook == null) {
			throwEndpointError(apiErrors.storeBookDoesNotExist)
		}

		// Check if the store book belongs to the user
		if (storeBook.userId != BigInt(user.Id)) {
			throwEndpointError(apiErrors.actionNotAllowed)
		}

		// Get the latest release of the store book
		let release = await getLastReleaseOfStoreBook(prisma, storeBook.id, false)

		if (release == null) {
			throwEndpointError(apiErrors.unexpectedError)
		}

		// Get the file name
		let fileUuid = null
		let ext = contentType == "application/pdf" ? "pdf" : "epub"
		let contentDisposition = req.headers["content-disposition"]
		let fileName = getFilename(contentDisposition)
		if (fileName != null) fileName = decodeURI(fileName)

		if (release.status == "published") {
			// Create a new release
			let newRelease = await createNewStoreBookRelease(
				prisma,
				accessToken,
				storeBook,
				release,
				user.Id
			)

			// Create a new StoreBookFile & update the release
			fileUuid = await createFile(
				prisma,
				accessToken,
				BigInt(user.Id),
				newRelease.id,
				req.body,
				contentType,
				ext,
				fileName
			)
		} else {
			// Get the previous published release
			let previousRelease = await getLastReleaseOfStoreBook(
				prisma,
				storeBook.id,
				true
			)

			// Check if the file of the current release was already changed
			if (
				release.fileId == null ||
				release.fileId == previousRelease.fileId
			) {
				// Create a new StoreBookFile & update the release
				fileUuid = await createFile(
					prisma,
					accessToken,
					BigInt(user.Id),
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
					await TableObjectsController.updateTableObject(`uuid`, {
						accessToken,
						uuid: fileUuid,
						ext,
						properties: {
							file_name: fileName
						}
					})

				if (Array.isArray(updateFileResponse)) {
					throwEndpointError(apiErrors.unexpectedError)
				}

				// Upload the data
				let setTableObjectFileResponse =
					await TableObjectsController.uploadTableObjectFile({
						accessToken,
						uuid: fileUuid,
						data: req.body,
						contentType
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
	let createFileResponse = await TableObjectsController.createTableObject(
		`uuid`,
		{
			accessToken,
			tableId: storeBookFileTableId,
			file: true,
			ext,
			properties: {
				file_name: fileName
			}
		}
	)

	if (Array.isArray(createFileResponse)) {
		throwEndpointError(apiErrors.unexpectedError)
	}

	const createFileResponseData = createFileResponse as TableObjectResource
	const fileUuid = createFileResponseData.uuid

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
		await TableObjectsController.uploadTableObjectFile({
			accessToken,
			uuid: fileUuid,
			data,
			contentType
		})

	if (!isSuccessStatusCode(setTableObjectFileResponse.status)) {
		throwEndpointError(apiErrors.unexpectedError)
	}

	return fileUuid
}
//#endregion
