import {
	Author,
	StoreBookCollection,
	StoreBookCollectionName
} from "@prisma/client"
import { ResolverContext, QueryResult, List, StoreBook } from "../types.js"
import { loadStoreBookData } from "../utils.js"

export async function retrieveStoreBookCollection(
	parent: any,
	args: { uuid: string },
	context: ResolverContext
): Promise<QueryResult<StoreBookCollection>> {
	return {
		caching: true,
		data: await context.prisma.storeBookCollection.findFirst({
			where: { uuid: args.uuid }
		})
	}
}

export async function author(
	storeBookCollection: StoreBookCollection,
	args: any,
	context: ResolverContext
): Promise<QueryResult<Author>> {
	return {
		caching: true,
		data: await context.prisma.author.findFirst({
			where: { id: storeBookCollection.authorId }
		})
	}
}

export async function name(
	storeBookCollection: StoreBookCollection,
	args: { languages?: String[] },
	context: ResolverContext
): Promise<QueryResult<StoreBookCollectionName>> {
	let languages = args.languages || ["en"]
	let where = { OR: [], AND: { collectionId: storeBookCollection.id } }

	for (let lang of languages) {
		where.OR.push({ language: lang })
	}

	let names = await context.prisma.storeBookCollectionName.findMany({ where })

	if (names.length == 0) {
		return {
			caching: true,
			data: null
		}
	}

	// Find the optimal name for the given languages
	for (let lang of languages) {
		let name = names.find(n => n.language == lang)

		if (name != null) {
			return {
				caching: true,
				data: name
			}
		}
	}

	return {
		caching: true,
		data: names[0]
	}
}

export async function names(
	storeBookCollection: StoreBookCollection,
	args: { limit?: number; offset?: number },
	context: ResolverContext
): Promise<QueryResult<List<StoreBookCollectionName>>> {
	let take = args.limit || 10
	if (take <= 0) take = 10

	let skip = args.offset || 0
	if (skip < 0) skip = 0

	let where = { collectionId: storeBookCollection.id }

	const [total, items] = await context.prisma.$transaction([
		context.prisma.storeBookCollectionName.count({ where }),
		context.prisma.storeBookCollectionName.findMany({
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

export async function storeBooks(
	storeBookCollection: StoreBookCollection,
	args: { limit?: number; offset?: number },
	context: ResolverContext
): Promise<QueryResult<List<StoreBook>>> {
	let take = args.limit || 10
	if (take <= 0) take = 10

	let skip = args.offset || 0
	if (skip < 0) skip = 0

	let where = { collectionId: storeBookCollection.id }

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
		caching: true,
		data: {
			total,
			items
		}
	}
}
