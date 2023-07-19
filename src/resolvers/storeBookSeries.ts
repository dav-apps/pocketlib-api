import { List, TableObject, StoreBookSeries, StoreBook } from "../types.js"
import {
	loadStoreBookData,
	convertTableObjectToStoreBookSeries,
	convertTableObjectToStoreBook
} from "../utils.js"
import { getTableObject, listTableObjects } from "../services/apiService.js"

export async function retrieveStoreBookSeries(
	parent: any,
	args: { uuid: string }
): Promise<StoreBookSeries> {
	const uuid = args.uuid
	if (uuid == null) return null

	let tableObject = await getTableObject(uuid)
	if (tableObject == null) return null

	return convertTableObjectToStoreBookSeries(tableObject)
}

export async function listStoreBookSeries(
	parent: any,
	args: {
		latest?: boolean
		languages?: string[]
		limit?: number
		offset?: number
	}
): Promise<List<StoreBookSeries>> {
	let total = 0
	let tableObjects: TableObject[] = []

	let limit = args.limit || 10
	if (limit <= 0) limit = 10

	let offset = args.offset || 0
	if (offset < 0) offset = 0

	let languages = args.languages || ["en"]

	if (args.latest) {
		let response = await listTableObjects({
			limit,
			offset,
			collectionName: "latest_series"
		})

		total = response.total
		tableObjects = response.items
	}

	let result: StoreBookSeries[] = []

	for (let obj of tableObjects) {
		let storeBookSeries = convertTableObjectToStoreBookSeries(obj)

		if (languages.includes(storeBookSeries.language)) {
			result.push(storeBookSeries)
		}
	}

	return {
		total,
		items: result
	}
}

export async function storeBooks(
	storeBookSeries: StoreBookSeries,
	args: { limit?: number; offset?: number }
): Promise<List<StoreBook>> {
	let storeBookUuidsString = storeBookSeries.storeBooks

	if (storeBookUuidsString == null) {
		return {
			total: 0,
			items: []
		}
	}

	let limit = args.limit || 10
	if (limit <= 0) limit = 10

	let offset = args.offset || 0
	if (offset < 0) offset = 0

	let storeBookUuids = storeBookUuidsString.split(",")
	let storeBooks: StoreBook[] = []

	for (let uuid of storeBookUuids) {
		let tableObject = await getTableObject(uuid)
		if (tableObject == null) continue

		let storeBook = convertTableObjectToStoreBook(tableObject)
		await loadStoreBookData(storeBook)
		storeBooks.push(storeBook)
	}

	return {
		total: storeBooks.length,
		items: storeBooks.slice(offset, limit + offset)
	}
}
