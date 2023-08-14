import { Category, CategoryName } from "@prisma/client"
import { ResolverContext, List } from "../types.js"

export async function listCategories(
	parent: any,
	args: { limit?: number; offset?: number },
	context: ResolverContext
): Promise<List<Category>> {
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
		total,
		items
	}
}

export async function name(
	category: Category,
	args: { languages?: String[] },
	context: ResolverContext
): Promise<CategoryName> {
	let languages = args.languages || ["en"]
	let where = { OR: [], AND: { categoryId: category.id } }

	for (let lang of languages) {
		where.OR.push({ language: lang })
	}

	let names = await context.prisma.categoryName.findMany({ where })

	if (names.length == null) {
		return null
	}

	// Find the optimal name for the given languages
	for (let lang of languages) {
		let name = names.find(n => n.language == lang)

		if (name != null) {
			return name
		}
	}

	return names[0]
}

export async function names(
	category: Category,
	args: { limit?: number; offset?: number },
	context: ResolverContext
): Promise<List<CategoryName>> {
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
		total,
		items
	}
}
