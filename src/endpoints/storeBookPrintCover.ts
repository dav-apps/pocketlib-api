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
import { storeBookPrintCoverTableId } from "../constants.js"
import { apiErrors } from "../errors.js"
import { validatePdfContentType } from "../services/validationService.js"
import { prisma } from "../../server.js"

async function uploadStoreBookPrintCover(req: Request, res: Response) {
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
		if (storeBook.userId != BigInt(user.id)) {
			throwEndpointError(apiErrors.actionNotAllowed)
		}

		// Get the latest release of the store book
		let release = await getLastReleaseOfStoreBook(prisma, storeBook.id, false)

		if (release == null) {
			throwEndpointError(apiErrors.unexpectedError)
		}

		// Get the file name
		let printCoverUuid = null
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
				user.id
			)

			// Create a new StoreBookPrintCover & update the release
			printCoverUuid = await createPrintCover(
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

			// Check if the printCover of the current release was already changed
			if (
				release.printCoverId == null ||
				release.printCoverId == previousRelease.printCoverId
			) {
				// Create a new StoreBookPrintCover & update the release
				printCoverUuid = await createPrintCover(
					prisma,
					accessToken,
					BigInt(user.id),
					release.id,
					req.body,
					fileName
				)
			} else {
				// Update the existing printCover
				let printCover = await prisma.storeBookPrintCover.update({
					where: { id: release.printCoverId },
					data: {
						fileName
					}
				})

				printCoverUuid = printCover.uuid

				// Update the existing printCover table object
				let updateFileResponse =
					await TableObjectsController.UpdateTableObject({
						accessToken,
						uuid: printCoverUuid,
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
						uuid: printCoverUuid,
						data: req.body,
						type: "application/pdf"
					})

				if (!isSuccessStatusCode(setTableObjectFileResponse.status)) {
					throwEndpointError(apiErrors.unexpectedError)
				}
			}
		}

		let result = {
			uuid: printCoverUuid,
			fileName
		}

		res.status(200).json(result)
	} catch (error) {
		handleEndpointError(res, error)
	}
}

export function setup(app: Express) {
	app.put(
		"/storeBooks/:uuid/printCover",
		raw({ type: "*/*", limit: "100mb" }),
		cors(),
		uploadStoreBookPrintCover
	)
}

//#region Helper functions
async function createPrintCover(
	prisma: PrismaClient,
	accessToken: string,
	userId: bigint,
	releaseId: bigint,
	data: any,
	fileName: string
) {
	// Create the printCover table object
	let createPrintCoverResponse =
		await TableObjectsController.CreateTableObject({
			accessToken,
			tableId: storeBookPrintCoverTableId,
			file: true,
			properties: {
				ext: "pdf",
				file_name: fileName
			}
		})

	if (!isSuccessStatusCode(createPrintCoverResponse.status)) {
		throwEndpointError(apiErrors.unexpectedError)
	}

	let createPrintCoverResponseData = (
		createPrintCoverResponse as ApiResponse<TableObjectsController.TableObjectResponseData>
	).data

	const printCoverUuid = createPrintCoverResponseData.tableObject.Uuid

	// Create the printCover
	await prisma.storeBookPrintCover.create({
		data: {
			uuid: printCoverUuid,
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
			uuid: printCoverUuid,
			data,
			type: "application/pdf"
		})

	if (!isSuccessStatusCode(setTableObjectFileResponse.status)) {
		throwEndpointError(apiErrors.unexpectedError)
	}

	return printCoverUuid
}
//#endregion
