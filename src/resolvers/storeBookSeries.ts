import { PrismaClient, Author, StoreBookSeries } from "@prisma/client"
import * as crypto from "crypto"
import { ResolverContext, List, StoreBook } from "../types.js"
import {
	throwApiError,
	throwValidationError,
	loadStoreBookData
} from "../utils.js"
import { admins } from "../constants.js"
import { apiErrors, validationErrors } from "../errors.js"
import {
	validateNameLength,
	validateLanguage
} from "../services/validationService.js"

export async function retrieveStoreBookSeries(
	parent: any,
	args: { uuid: string },
	context: ResolverContext
): Promise<StoreBookSeries> {
	return await context.prisma.storeBookSeries.findFirst({
		where: { uuid: args.uuid }
	})
}

export async function listStoreBookSeries(
	parent: any,
	args: {
		languages?: string[]
		limit?: number
		offset?: number
	},
	context: ResolverContext
): Promise<List<StoreBookSeries>> {
	let take = args.limit || 10
	if (take <= 0) take = 10

	let skip = args.offset || 0
	if (skip < 0) skip = 0

	let languages = args.languages || ["en"]
	let where = { language: { in: languages } }

	let [total, items] = await context.prisma.$transaction([
		context.prisma.storeBookSeries.count({ where }),
		context.prisma.storeBookSeries.findMany({
			where,
			take,
			skip
		})
	])

	return {
		total,
		items
	}
}

export async function createStoreBookSeries(
	parent: any,
	args: {
		author?: string
		name: string
		language: string
		storeBooks?: string[]
	},
	context: ResolverContext
): Promise<StoreBookSeries> {
	const user = context.user

	if (user == null) {
		throwApiError(apiErrors.notAuthenticated)
	}

	const isAdmin = admins.includes(user.id)

	// Validate the args
	throwValidationError(
		validateNameLength(args.name),
		validateLanguage(args.language)
	)

	let author: Author = null

	if (isAdmin) {
		if (args.author == null) {
			throwValidationError(validationErrors.authorRequired)
		}

		author = await context.prisma.author.findFirst({
			where: { uuid: args.author }
		})

		if (author == null) {
			throwApiError(apiErrors.authorDoesNotExist)
		}
	} else {
		// Get the author of the user
		author = await context.prisma.author.findFirst({
			where: { userId: user.id }
		})

		if (author == null) {
			throwApiError(apiErrors.actionNotAllowed)
		}
	}

	let storeBookIds = await validateStoreBooksParam(
		context.prisma,
		args.storeBooks,
		args.language
	)

	// Create the store book series
	let seriesData = {
		uuid: crypto.randomUUID(),
		author: {
			connect: {
				id: author.id
			}
		},
		name: args.name,
		language: args.language,
		storeBooks: {
			connect: []
		}
	}

	for (let id of storeBookIds) {
		seriesData.storeBooks.connect.push({ id })
	}

	return await context.prisma.storeBookSeries.create({
		data: seriesData
	})
}

export async function updateStoreBookSeries(
	parent: any,
	args: {
		uuid: string
		name?: string
		storeBooks?: string[]
	},
	context: ResolverContext
): Promise<StoreBookSeries> {
	const uuid = args.uuid
	if (uuid == null) return null

	const user = context.user

	if (user == null) {
		throwApiError(apiErrors.notAuthenticated)
	}

	const isAdmin = admins.includes(user.id)

	// Get the store book series
	let storeBookSeries = await context.prisma.storeBookSeries.findFirst({
		where: { uuid: args.uuid }
	})

	if (storeBookSeries == null) {
		throwApiError(apiErrors.storeBookSeriesDoesNotExist)
	}

	// Check if the store book series belongs to the user
	if (!isAdmin && storeBookSeries.userId != BigInt(user.id)) {
		throwApiError(apiErrors.actionNotAllowed)
	}

	// Validate the args
	if (args.name == null && args.storeBooks == null) {
		return storeBookSeries
	}

	if (args.name != null) {
		throwValidationError(validateNameLength(args.name))
	}

	// Update the store book series
	let data = {}

	if (args.name != null) {
		data["name"] = args.name
	}

	if (args.storeBooks != null) {
		let storeBookIds = await validateStoreBooksParam(
			context.prisma,
			args.storeBooks,
			storeBookSeries.language
		)

		let connect = []

		for (let id of storeBookIds) {
			connect.push({ id })
		}

		data["storeBooks"] = { connect }
	}

	return await context.prisma.storeBookSeries.update({
		where: { id: storeBookSeries.id },
		data
	})
}

export async function storeBooks(
	storeBookSeries: StoreBookSeries,
	args: { limit?: number; offset?: number },
	context: ResolverContext
): Promise<List<StoreBook>> {
	let take = args.limit || 10
	if (take <= 0) take = 10

	let skip = args.offset || 0
	if (skip < 0) skip = 0

	let where = { series: { some: { id: storeBookSeries.id } } }

	let total = await context.prisma.storeBook.count({ where })

	let items = (await context.prisma.storeBook.findMany({
		where,
		take,
		skip
	})) as StoreBook[]

	for (let storeBook of items) {
		await loadStoreBookData(context.prisma, storeBook)
	}

	return {
		total,
		items
	}
}

//#region Helper functions
async function validateStoreBooksParam(
	prisma: PrismaClient,
	storeBooks: string[],
	language: string
): Promise<bigint[]> {
	if (storeBooks == null) {
		return []
	}

	let storeBookIds = []

	for (let uuid of storeBooks) {
		// Get the store book
		let storeBook = await prisma.storeBook.findFirst({ where: { uuid } })

		if (storeBook == null) {
			throwApiError(apiErrors.storeBookDoesNotExist)
		}

		if (storeBook.language != language) {
			throwApiError(apiErrors.storeBookLanguageNotMatching)
		}

		storeBookIds.push(storeBook.id)
	}

	return storeBookIds
}
//#endregion
