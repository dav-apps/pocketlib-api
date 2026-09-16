import { Express, Request, Response, raw } from "express"
import cors from "cors"
import { withPdfDocument } from "../services/pdfService.js"
import { PrismaClient } from "../generated/prisma/client.js"
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
import { storeBookPrintCoverTableId } from "../constants.js"
import { apiErrors } from "../errors.js"
import { validatePdfContentType } from "../services/validationService.js"
import { invalidateCache } from "../services/cachingService.js"
import type { AppDependencies } from "../appDependencies.js"

async function uploadStoreBookPrintCover(
	req: Request<{ uuid: string }>,
	res: Response,
	{ prisma, redis }: Pick<AppDependencies, "prisma" | "redis">
) {
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

		if (storeBook == null) throwEndpointError(apiErrors.storeBookDoesNotExist)

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
		let printCoverUuid = null
		let contentDisposition = req.headers["content-disposition"]
		let fileName = getFilename(contentDisposition)
		if (fileName != null) fileName = decodeURI(fileName)

		await withPdfDocument({ data: new Uint8Array(req.body) }, () => undefined)

		if (release.status == "published") {
			// Create a new release
			let newRelease = await createNewStoreBookRelease(
				prisma,
				accessToken,
				storeBook,
				release,
				user.Id
			)

			// Create a new StoreBookPrintCover & update the release
			printCoverUuid = await createPrintCover(
				prisma,
				accessToken,
				BigInt(user.Id),
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
					BigInt(user.Id),
					release.id,
					req.body,
					fileName
				)
			} else {
				// Update the existing printCover
				let printCover = await prisma.storeBookPrintCover.findUnique({
					where: { id: release.printCoverId }
				})

				printCoverUuid = printCover.uuid

				// Update the existing printCover table object
				let updateFileResponse =
					await TableObjectsController.updateTableObject(`uuid`, {
						accessToken,
						uuid: printCoverUuid,
						ext: "pdf",
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
						uuid: printCoverUuid,
						data: req.body,
						contentType: "application/pdf"
					})

				if (!isSuccessStatusCode(setTableObjectFileResponse.status)) {
					throwEndpointError(apiErrors.unexpectedError)
				}
				await prisma.storeBookPrintCover.update({
					where: { id: release.printCoverId },
					data: {
						fileName
					}
				})
			}
		}

		let result = {
			uuid: printCoverUuid,
			fileName
		}

		await invalidateCache(redis)
		res.status(200).json(result)
	} catch (error) {
		handleEndpointError(res, error)
	}
}

export function setup(
	app: Express,
	dependencies: Pick<AppDependencies, "prisma" | "redis">
) {
	app.put(
		"/storeBooks/:uuid/printCover",
		raw({ type: "*/*", limit: "100mb" }),
		cors(),
		(req, res) => uploadStoreBookPrintCover(req, res, dependencies)
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
		await TableObjectsController.createTableObject(`uuid`, {
			accessToken,
			tableId: storeBookPrintCoverTableId,
			file: true,
			ext: "pdf",
			properties: {
				file_name: fileName
			}
		})

	if (Array.isArray(createPrintCoverResponse)) {
		throwEndpointError(apiErrors.unexpectedError)
	}

	const createPrintCoverResponseData =
		createPrintCoverResponse as TableObjectResource
	const printCoverUuid = createPrintCoverResponseData.uuid

	// Upload the data
	let setTableObjectFileResponse =
		await TableObjectsController.uploadTableObjectFile({
			accessToken,
			uuid: printCoverUuid,
			data,
			contentType: "application/pdf"
		})

	if (!isSuccessStatusCode(setTableObjectFileResponse.status)) {
		throwEndpointError(apiErrors.unexpectedError)
	}

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

	return printCoverUuid
}
//#endregion
