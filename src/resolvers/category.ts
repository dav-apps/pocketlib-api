import { Category, CategoryName } from "@prisma/client"
import { ResolverContext, QueryResult, List } from "../types.js"

export async function retrieveCategory(
	parent: any,
	args: { uuid: string },
	context: ResolverContext
): Promise<QueryResult<Category>> {
	return {
		caching: true,
		data: await context.prisma.category.findFirst({
			where: { uuid: args.uuid }
		})
	}
}

export async function listCategories(
	parent: any,
	args: { limit?: number; offset?: number },
	context: ResolverContext
): Promise<QueryResult<List<Category>>> {
	let take = args.limit || 10
	if (take <= 0) take = 10

	let skip = args.offset || 0
	if (skip < 0) skip = 0

	let [total, items] = await context.prisma.$transaction([
		context.prisma.category.count(),
		context.prisma.category.findMany({
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

export async function name(
	category: Category,
	args: { language?: string },
	context: ResolverContext
): Promise<QueryResult<CategoryName>> {
	let language = args.language || "en"
	let names = await context.prisma.categoryName.findMany({
		where: { categoryId: category.id }
	})

	if (names.length == null) {
		return {
			caching: true,
			data: null
		}
	}

	// Find the optimal name for the given languages
	let name = names.find(n => n.language == language)

	if (name != null) {
		return {
			caching: true,
			data: name
		}
	}

	return {
		caching: true,
		data: names[0]
	}
}

export async function names(
	category: Category,
	args: { limit?: number; offset?: number },
	context: ResolverContext
): Promise<QueryResult<List<CategoryName>>> {
	let take = args.limit || 10
	if (take <= 0) take = 10

	let skip = args.offset || 0
	if (skip < 0) skip = 0

	let where = { categoryId: category.id }

	const [total, items] = await context.prisma.$transaction([
		context.prisma.categoryName.count({ where }),
		context.prisma.categoryName.findMany({
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
