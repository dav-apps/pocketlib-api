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
import { storeBookPrintFileTableId } from "../constants.js"
import { apiErrors } from "../errors.js"
import { validatePdfContentType } from "../services/validationService.js"
import { prisma } from "../../server.js"

export async function uploadStoreBookPrintFile(req: Request, res: Response) {
	try {
		const uuid = req.params.uuid
		const accessToken = req.headers.authorization
		const user = await getUserForEndpoint(accessToken)

		if (user == null) {
			throwEndpointError(apiErrors.notAuthenticated)
		}

		// Check if content type is supported
		const contentType = req.headers["content-type"]
		validatePdfContentType(contentType)

		// Get the store book
		let storeBook = (await prisma.storeBook.findFirst({
			where: { uuid }
		})) as StoreBook

		// Check if the store book belongs to the user
		if (storeBook.userId != BigInt(user.id)) {
			throwEndpointError(apiErrors.actionNotAllowed)
		}

		// Get the latest release of the store book
		let release = await getLastReleaseOfStoreBook(prisma, storeBook.id, false)

		if (release == null) {
			throwEndpointError(apiErrors.unexpectedError)
		}

		// Get the file name
		let printFileUuid = null
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

			// Create a new StoreBookPrintFile & update the release
			printFileUuid = await createPrintFile(
				prisma,
				accessToken,
				BigInt(user.id),
				newRelease.id,
				req.body,
				fileName
			)
		} else {
			// Get the previous published release
			let previousRelease = await getLastReleaseOfStoreBook(
				prisma,
				storeBook.id,
				true
			)

			// Check if the printFile of the current release was already changed
			if (
				release.printFileId == null ||
				release.printFileId == previousRelease.printFileId
			) {
				// Create a new StoreBookPrintFile & update the release
				printFileUuid = await createPrintFile(
					prisma,
					accessToken,
					BigInt(user.id),
					release.id,
					req.body,
					fileName
				)
			} else {
				// Update the existing printFile
				let printFile = await prisma.storeBookPrintFile.update({
					where: { id: release.printFileId },
					data: {
						fileName
					}
				})

				printFileUuid = printFile.uuid

				// Update the existing printFile table object
				let updateFileResponse =
					await TableObjectsController.UpdateTableObject({
						accessToken,
						uuid: printFileUuid,
						properties: {
							ext: "pdf",
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
						uuid: printFileUuid,
						data: req.body,
						type: "application/pdf"
					})

				if (!isSuccessStatusCode(setTableObjectFileResponse.status)) {
					throwEndpointError(apiErrors.unexpectedError)
				}
			}
		}

		let result = {
			uuid: printFileUuid,
			fileName
		}

		res.status(200).json(result)
	} catch (error) {
		handleEndpointError(res, error)
	}
}

export function setup(app: Express) {
	app.put(
		"/storeBooks/:uuid/printFile",
		raw({ type: "*/*", limit: "100mb" }),
		cors(),
		uploadStoreBookPrintFile
	)
}

//#region Helper functions
async function createPrintFile(
	prisma: PrismaClient,
	accessToken: string,
	userId: bigint,
	releaseId: bigint,
	data: any,
	fileName: string
) {
	// Create the printFile table object
	let createPrintFileResponse = await TableObjectsController.CreateTableObject(
		{
			accessToken,
			tableId: storeBookPrintFileTableId,
			file: true,
			properties: {
				ext: "pdf",
				file_name: fileName
			}
		}
	)

	if (!isSuccessStatusCode(createPrintFileResponse.status)) {
		throwEndpointError(apiErrors.unexpectedError)
	}

	let createPrintFileResponseData = (
		createPrintFileResponse as ApiResponse<TableObjectsController.TableObjectResponseData>
	).data

	const printFileUuid = createPrintFileResponseData.tableObject.Uuid

	// Create the printFile
	await prisma.storeBookPrintFile.create({
		data: {
			uuid: printFileUuid,
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
			uuid: printFileUuid,
			data,
			type: "application/pdf"
		})

	if (!isSuccessStatusCode(setTableObjectFileResponse.status)) {
		throwEndpointError(apiErrors.unexpectedError)
	}

	return printFileUuid
}
//#endregion
