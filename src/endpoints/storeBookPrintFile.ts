import { Express, Request, Response, raw } from "express"
import cors from "cors"
import { PrismaClient } from "@prisma/client"
import { getDocument } from "pdfjs-dist"
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
import { storeBookPrintFileTableId } from "../constants.js"
import { apiErrors } from "../errors.js"
import { validatePdfContentType } from "../services/validationService.js"
import { prisma } from "../../server.js"

async function uploadStoreBookPrintFile(req: Request, res: Response) {
	try {
		const uuid = req.params.uuid
		const accessToken = req.headers.authorization
		const user = await getUserForEndpoint(accessToken)

		if (user == null) {
			throwEndpointError(apiErrors.notAuthenticated)
		}

		// Check if content type is supported
		const contentType = req.headers["content-type"]
		throwEndpointError(validatePdfContentType(contentType))

		// Get the store book
		let storeBook = (await prisma.storeBook.findFirst({
			where: { uuid }
		})) as StoreBook

		// Check if the store book belongs to the user
		if (storeBook.userId != BigInt(user.Id)) {
			throwEndpointError(apiErrors.actionNotAllowed)
		}

		// Get the latest release of the store book
		let release = await getLastReleaseOfStoreBook(prisma, storeBook.id, false)

		if (release == null) {
			throwEndpointError(apiErrors.unexpectedError)
		}

		// Get the pages & file name
		let printFileUuid = null
		let contentDisposition = req.headers["content-disposition"]
		let fileName = getFilename(contentDisposition)
		if (fileName != null) fileName = decodeURI(fileName)

		let pdf = await getDocument(new Uint8Array(req.body)).promise
		const pages = pdf.numPages

		if (release.status == "published") {
			// Create a new release
			let newRelease = await createNewStoreBookRelease(
				prisma,
				accessToken,
				storeBook,
				release,
				user.Id
			)

			// Create a new StoreBookPrintFile & update the release
			printFileUuid = await createPrintFile(
				prisma,
				accessToken,
				BigInt(user.Id),
				newRelease.id,
				req.body,
				pages,
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
					BigInt(user.Id),
					release.id,
					req.body,
					pages,
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
					await TableObjectsController.updateTableObject(`uuid`, {
						accessToken,
						uuid: printFileUuid,
						ext: "pdf",
						properties: {
							pages,
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
						uuid: printFileUuid,
						data: req.body,
						contentType: "application/pdf"
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
	pages: number,
	fileName: string
) {
	// Create the printFile table object
	let createPrintFileResponse = await TableObjectsController.createTableObject(
		`uuid`,
		{
			accessToken,
			tableId: storeBookPrintFileTableId,
			file: true,
			ext: "pdf",
			properties: {
				pages,
				file_name: fileName
			}
		}
	)

	if (Array.isArray(createPrintFileResponse)) {
		throwEndpointError(apiErrors.unexpectedError)
	}

	const createPrintFileResponseData =
		createPrintFileResponse as TableObjectResource
	const printFileUuid = createPrintFileResponseData.uuid

	// Create the printFile
	await prisma.storeBookPrintFile.create({
		data: {
			uuid: printFileUuid,
			userId,
			releases: {
				connect: [{ id: releaseId }]
			},
			pages,
			fileName
		}
	})

	// Upload the data
	let setTableObjectFileResponse =
		await TableObjectsController.uploadTableObjectFile({
			accessToken,
			uuid: printFileUuid,
			data,
			contentType: "application/pdf"
		})

	if (!isSuccessStatusCode(setTableObjectFileResponse.status)) {
		throwEndpointError(apiErrors.unexpectedError)
	}

	return printFileUuid
}
//#endregion
