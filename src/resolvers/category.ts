import { ResolverContext, List, Category, CategoryName } from "../types.js"
import {
	convertTableObjectToCategory,
	convertTableObjectToCategoryName
} from "../utils.js"
import { getTableObject, listTableObjects } from "../services/apiService.js"

export async function listCategories(
	parent: any,
	args: { limit?: number; offset?: number }
): Promise<List<Category>> {
	let limit = args.limit || 10
	if (limit <= 0) limit = 10

	let offset = args.offset || 0
	if (offset < 0) offset = 0

	let response = await listTableObjects({
		tableName: "Category",
		limit,
		offset
	})

	let result: Category[] = []

	for (let obj of response.items) {
		result.push(convertTableObjectToCategory(obj))
	}

	return {
		total: response.total,
		items: result
	}
}

export async function name(
	category: Category,
	args: any,
	context: ResolverContext,
	info: any
): Promise<CategoryName> {
	const namesString = category.names
	if (namesString == null) return null

	// Get all names
	let nameUuids = namesString.split(",")
	let names: CategoryName[] = []

	for (let uuid of nameUuids) {
		let nameObj = await getTableObject(uuid)
		if (nameObj == null) continue

		names.push(convertTableObjectToCategoryName(nameObj))
	}

	// Find the optimal name for the given languages
	let languages = info?.variableValues?.languages || ["en"]
	let selectedNames: CategoryName[] = []

	for (let lang of languages) {
		let name = names.find(n => n.language == lang)

		if (name != null) {
			selectedNames.push(name)
		}
	}

	if (selectedNames.length > 0) {
		return selectedNames[0]
	}

	return names[0]
}

export async function names(
	category: Category,
	args: { limit?: number; offset?: number }
): Promise<List<CategoryName>> {
	let categoryNameUuidsString = category.names

	if (categoryNameUuidsString == null) {
		return {
			total: 0,
			items: []
		}
	}

	let limit = args.limit || 10
	if (limit <= 0) limit = 10

	let offset = args.offset || 0
	if (offset < 0) offset = 0

	let categoryNameUuids = categoryNameUuidsString.split(",")
	let categoryNames: CategoryName[] = []

	for (let uuid of categoryNameUuids) {
		let tableObject = await getTableObject(uuid)
		if (tableObject == null) continue

		categoryNames.push(convertTableObjectToCategoryName(tableObject))
	}

	return {
		total: categoryNames.length,
		items: categoryNames.slice(offset, limit + offset)
	}
}
