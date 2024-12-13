import { VlbAuthor } from "@prisma/client"
import validator from "validator"
import { List, QueryResult, ResolverContext } from "../types.js"

export async function retrieveVlbAuthor(
	parent: any,
	args: { uuid: string },
	context: ResolverContext
): Promise<QueryResult<VlbAuthor>> {
	const uuid = args.uuid
	let where: any = { uuid }

	if (!validator.isUUID(uuid)) {
		where = { slug: uuid }
	}

	let vlbAuthor = await context.prisma.vlbAuthor.findFirst({ where })

	return {
		caching: vlbAuthor != null,
		data: vlbAuthor
	}
}

export async function listVlbAuthors(
	parent: any,
	args: {
		limit?: number
		offset?: number
	},
	context: ResolverContext
): Promise<QueryResult<List<VlbAuthor>>> {
	let take = args.limit || 10
	if (take <= 0) take = 10

	let skip = args.offset || 0
	if (skip < 0) skip = 0

	let [total, items] = await context.prisma.$transaction([
		context.prisma.vlbAuthor.count(),
		context.prisma.vlbAuthor.findMany({
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
