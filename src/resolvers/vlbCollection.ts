import { VlbCollection, VlbItem } from "@prisma/client"
import validator from "validator"
import { getCollection } from "../services/vlbApiService.js"
import { List, QueryResult, ResolverContext } from "../types.js"
import {
	randomNumber,
	findVlbItemByVlbGetCollectionResponseDataItem
} from "../utils.js"

export async function retrieveVlbCollection(
	parent: any,
	args: { uuid: string },
	context: ResolverContext
): Promise<QueryResult<VlbCollection>> {
	const uuid = args.uuid
	let where: any = { uuid }

	if (!validator.isUUID(uuid)) {
		where = { slug: uuid }
	}

	let vlbCollection = await context.prisma.vlbCollection.findFirst({ where })

	return {
		caching: vlbCollection != null,
		data: vlbCollection
	}
}

export async function listVlbCollections(
	parent: any,
	args: {
		random?: boolean
		limit?: number
		offset?: number
	},
	context: ResolverContext
) {
	let take = args.limit || 10
	if (take <= 0) take = 10

	let skip = args.offset || 0
	if (skip < 0) skip = 0

	let random = args.random || false

	if (random) {
		let total = await context.prisma.vlbCollection.count()
		if (take > total) take = total

		let indices = []
		let items = []

		while (indices.length < take) {
			let i = randomNumber(0, total - 1)

			if (!indices.includes(i)) {
				indices.push(i)
			}
		}

		for (let i of indices) {
			items.push(
				await context.prisma.vlbCollection.findFirst({
					skip: i
				})
			)
		}

		return {
			caching: true,
			data: {
				total,
				items
			}
		}
	}

	let [total, items] = await context.prisma.$transaction([
		context.prisma.vlbCollection.count(),
		context.prisma.vlbCollection.findMany({
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

export async function vlbItems(
	vlbCollection: VlbCollection,
	args: {
		limit: number
		offset: number
	},
	context: ResolverContext
): Promise<QueryResult<List<VlbItem>>> {
	let take = args.limit || 10
	if (take <= 0) take = 10

	let skip = args.offset || 0
	if (skip < 0) skip = 0

	let result = await getCollection({
		collectionId: vlbCollection.mvbId,
		page: skip > 0 ? Math.floor(skip / take) + 1 : 1,
		size: take
	})

	let total = result.totalElements
	let items: VlbItem[] = []

	for (let product of result.content) {
		items.push(
			await findVlbItemByVlbGetCollectionResponseDataItem(
				context.prisma,
				product
			)
		)
	}

	return {
		caching: true,
		data: {
			total,
			items
		}
	}
}
