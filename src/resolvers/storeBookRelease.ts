import {
	StoreBookRelease,
	StoreBookFile,
	StoreBookPrintCover,
	StoreBookPrintFile,
	Category
} from "@prisma/client"
import { getDocument } from "pdfjs-dist"
import { ResolverContext, QueryResult, List, StoreBookCover } from "../types.js"
import {
	throwApiError,
	throwValidationError,
	getTableObjectFileUrl,
	getTableObjectFileCdnUrl
} from "../utils.js"
import { admins } from "../constants.js"
import { apiErrors } from "../errors.js"
import {
	validateReleaseNameLength,
	validateReleaseNotesLength,
	validateStoreBookPrintCoverPages,
	validateStoreBookPrintFilePages,
	validateStoreBookPrintCoverPageSize,
	validateStoreBookPrintFilePageSize
} from "../services/validationService.js"

export async function retrieveStoreBookRelease(
	parent: any,
	args: { uuid: string },
	context: ResolverContext
): Promise<QueryResult<StoreBookRelease>> {
	let release = await context.prisma.storeBookRelease.findFirst({
		where: { uuid: args.uuid }
	})

	if (release == null) {
		return {
			caching: true,
			data: null
		}
	}

	if (release.status == null) {
		release.status = "unpublished"
	}

	return {
		caching: true,
		data: release
	}
}

export async function publishStoreBookRelease(
	parent: any,
	args: {
		uuid: string
		releaseName: string
		releaseNotes?: string
	},
	context: ResolverContext
): Promise<StoreBookRelease> {
	const uuid = args.uuid
	const user = context.user

	if (user == null) {
		throwApiError(apiErrors.notAuthenticated)
	}

	const isAdmin = admins.includes(user.Id)

	// Get the store book release
	let storeBookRelease = await context.prisma.storeBookRelease.findFirst({
		where: { uuid },
		include: { printCover: true, printFile: true }
	})

	if (storeBookRelease == null) {
		throwApiError(apiErrors.storeBookReleaseDoesNotExist)
	}

	// Check if the release belongs to the user
	if (!isAdmin && storeBookRelease.userId != BigInt(user.Id)) {
		throwApiError(apiErrors.actionNotAllowed)
	}

	// Check if the release is unpublished
	if (storeBookRelease.status == "published") {
		throwApiError(apiErrors.storeBookReleaseAlreadyPublished)
	}

	// Get the store book
	let storeBook = await context.prisma.storeBook.findFirst({
		where: { id: storeBookRelease.storeBookId }
	})

	// Check if the store book is published or hidden
	if (storeBook.status != "published" && storeBook.status != "hidden") {
		throwApiError(apiErrors.storeBookNotPublished)
	}

	// Validate args
	let errors: string[] = [validateReleaseNameLength(args.releaseName)]

	if (args.releaseNotes != null) {
		errors.push(validateReleaseNotesLength(args.releaseNotes))
	}

	throwValidationError(...errors)

	if (
		storeBookRelease.printCover != null &&
		storeBookRelease.printFile != null
	) {
		// Validate the printCover and printFile
		const printCoverUrl = getTableObjectFileUrl(
			storeBookRelease.printCover.uuid
		)
		const printFileUrl = getTableObjectFileUrl(
			storeBookRelease.printFile.uuid
		)

		// Validate printFile pdf
		let printFilePdf = await getDocument(printFileUrl).promise
		const printFilePages = printFilePdf.numPages

		throwValidationError(validateStoreBookPrintFilePages(printFilePages))

		for (let i = 1; i <= printFilePages; i++) {
			let page = await printFilePdf.getPage(i)

			// Validate the page size
			const [x, y, w, h] = page._pageInfo.view
			throwValidationError(validateStoreBookPrintFilePageSize(w, h))
		}

		// Validate printCover pdf
		let printCoverPdf = await getDocument(printCoverUrl).promise
		const printCoverPages = printCoverPdf.numPages

		throwValidationError(validateStoreBookPrintCoverPages(printCoverPages))

		let printCoverFirstPage = await printCoverPdf.getPage(1)

		// Validate the page size
		const [x, y, w, h] = printCoverFirstPage._pageInfo.view
		throwValidationError(
			validateStoreBookPrintCoverPageSize(w, h, printFilePdf.numPages)
		)
	}

	// Publish the release
	return await context.prisma.storeBookRelease.update({
		where: { id: storeBookRelease.id },
		data: {
			status: "published",
			releaseName: args.releaseName,
			releaseNotes: args.releaseNotes,
			publishedAt: new Date()
		}
	})
}

export async function cover(
	storeBookRelease: StoreBookRelease,
	args: any,
	context: ResolverContext
): Promise<QueryResult<StoreBookCover>> {
	if (storeBookRelease.coverId == null) {
		return {
			caching: false,
			data: null
		}
	}

	let cover = await context.prisma.storeBookCover.findFirst({
		where: { id: storeBookRelease.coverId }
	})

	if (cover == null) {
		return {
			caching: true,
			data: null
		}
	}

	return {
		caching: true,
		data: {
			...cover,
			url: getTableObjectFileCdnUrl(cover.uuid)
		}
	}
}

export async function file(
	storeBookRelease: StoreBookRelease,
	args: any,
	context: ResolverContext
): Promise<QueryResult<StoreBookFile>> {
	if (storeBookRelease.fileId == null) {
		return {
			caching: false,
			data: null
		}
	}

	return {
		caching: true,
		data: await context.prisma.storeBookFile.findFirst({
			where: { id: storeBookRelease.fileId }
		})
	}
}

export async function printCover(
	storeBookRelease: StoreBookRelease,
	args: any,
	context: ResolverContext
): Promise<QueryResult<StoreBookPrintCover>> {
	if (storeBookRelease.printCoverId == null) {
		return {
			caching: false,
			data: null
		}
	}

	return {
		caching: true,
		data: await context.prisma.storeBookPrintCover.findFirst({
			where: { id: storeBookRelease.printCoverId }
		})
	}
}

export async function printFile(
	storeBookRelease: StoreBookRelease,
	args: any,
	context: ResolverContext
): Promise<QueryResult<StoreBookPrintFile>> {
	if (storeBookRelease.printFileId == null) {
		return {
			caching: false,
			data: null
		}
	}

	return {
		caching: true,
		data: await context.prisma.storeBookPrintFile.findFirst({
			where: { id: storeBookRelease.printFileId }
		})
	}
}

export async function categories(
	storeBookRelease: StoreBookRelease,
	args: { limit?: number; offset?: number },
	context: ResolverContext
): Promise<QueryResult<List<Category>>> {
	let take = args.limit || 10
	if (take <= 0) take = 10

	let skip = args.offset || 0
	if (skip < 0) skip = 0

	let where = { releases: { some: { id: storeBookRelease.id } } }

	let [total, items] = await context.prisma.$transaction([
		context.prisma.category.count({ where }),
		context.prisma.category.findMany({
			where,
			take,
			skip
		})
	])

	return {
		caching: true,
		data: {
			total,
			items
		}
	}
}
