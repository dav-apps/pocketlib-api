import {
	ResolverContext,
	List,
	Author,
	StoreBookCollection,
	StoreBookCollectionName,
	StoreBook
} from "../types.js"
import {
	loadStoreBookData,
	convertTableObjectToAuthor,
	convertTableObjectToStoreBookCollection,
	convertTableObjectToStoreBookCollectionName,
	convertTableObjectToStoreBook
} from "../utils.js"
import { getTableObject } from "../services/apiService.js"

export async function retrieveStoreBookCollection(
	parent: any,
	args: { uuid: string; languages?: string[] }
): Promise<StoreBookCollection> {
	const uuid = args.uuid
	if (uuid == null) return null

	let tableObject = await getTableObject(uuid)
	if (tableObject == null) return null

	return convertTableObjectToStoreBookCollection(tableObject)
}

export async function author(
	storeBookCollection: StoreBookCollection
): Promise<Author> {
	const uuid = storeBookCollection.author
	if (uuid == null) return null

	let tableObject = await getTableObject(uuid)
	if (tableObject == null) return null

	return convertTableObjectToAuthor(tableObject)
}

export async function name(
	storeBookCollection: StoreBookCollection,
	args: any,
	context: ResolverContext,
	info: any
): Promise<StoreBookCollectionName> {
	const namesString = storeBookCollection.names
	if (namesString == null) return null

	// Get all names
	let nameUuids = namesString.split(",")
	let names: StoreBookCollectionName[] = []

	for (let uuid of nameUuids) {
		let nameObj = await getTableObject(uuid)
		if (nameObj == null) continue

		names.push(convertTableObjectToStoreBookCollectionName(nameObj))
	}

	// Find the optimal name for the given languages
	let languages = info?.variableValues?.languages || ["en"]
	let selectedNames: StoreBookCollectionName[] = []

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
	storeBookCollection: StoreBookCollection,
	args: { limit?: number; offset?: number }
): Promise<List<StoreBookCollectionName>> {
	let nameUuidsString = storeBookCollection.names

	if (nameUuidsString == null) {
		return {
			total: 0,
			items: []
		}
	}

	let limit = args.limit || 10
	if (limit <= 0) limit = 10

	let offset = args.offset || 0
	if (offset < 0) offset = 0

	let nameUuids = nameUuidsString.split(",")
	let names: StoreBookCollectionName[] = []

	for (let uuid of nameUuids) {
		let tableObject = await getTableObject(uuid)
		if (tableObject == null) continue

		names.push(convertTableObjectToStoreBookCollectionName(tableObject))
	}

	return {
		total: names.length,
		items: names.slice(offset, limit + offset)
	}
}

export async function storeBooks(
	storeBookCollection: StoreBookCollection,
	args: { limit?: number; offset?: number }
): Promise<List<StoreBook>> {
	let storeBookUuidsString = storeBookCollection.storeBooks

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
