import {
	List,
	TableObject,
	Publisher,
	Author,
	AuthorBio,
	AuthorProfileImage,
	StoreBookCollection,
	StoreBookSeries
} from "../types.js"
import {
	convertTableObjectToPublisher,
	convertTableObjectToAuthor,
	convertTableObjectToAuthorBio,
	convertTableObjectToAuthorProfileImage,
	convertTableObjectToStoreBookCollection,
	convertTableObjectToStoreBookSeries
} from "../utils.js"
import { getTableObject, listTableObjects } from "../services/apiService.js"

export async function retrieveAuthor(
	parent: any,
	args: { uuid: string }
): Promise<Author> {
	const uuid = args.uuid
	if (uuid == null) return null

	let tableObject = await getTableObject(uuid)
	if (tableObject == null) return null

	return convertTableObjectToAuthor(tableObject)
}

export async function listAuthors(
	parent: any,
	args: { latest?: boolean; limit?: number; offset?: number }
): Promise<List<Author>> {
	let total = 0
	let tableObjects: TableObject[] = []

	let limit = args.limit || 10
	if (limit <= 0) limit = 10

	let offset = args.offset || 0
	if (offset < 0) offset = 0

	if (args.latest) {
		let response = await listTableObjects({
			limit,
			offset,
			collectionName: "latest_authors"
		})

		total = response.total
		tableObjects = response.items
	} else {
		let response = await listTableObjects({
			limit,
			offset,
			tableName: "Author"
		})

		total = response.total
		tableObjects = response.items
	}

	let result: Author[] = []

	for (let obj of tableObjects) {
		result.push(convertTableObjectToAuthor(obj))
	}

	return {
		total,
		items: result
	}
}

export async function publisher(author: Author): Promise<Publisher> {
	const uuid = author.publisher
	if (uuid == null) return null

	let tableObject = await getTableObject(uuid)
	if (tableObject == null) return null

	return convertTableObjectToPublisher(tableObject)
}

export async function bio(
	author: Author,
	args: any,
	context: any,
	info: any
): Promise<AuthorBio> {
	const biosString = author.bios
	if (biosString == null) return null

	// Get all bios
	let bioUuids = biosString.split(",")
	let bios: AuthorBio[] = []

	for (let uuid of bioUuids) {
		let bioObj = await getTableObject(uuid)
		if (bioObj == null) continue

		bios.push(convertTableObjectToAuthorBio(bioObj))
	}

	// Find the optimal bio for the given languages
	let languages = info?.variableValues?.languages || ["en"]
	let selectedBios: AuthorBio[] = []

	for (let lang of languages) {
		let bio = bios.find(b => b.language == lang)

		if (bio != null) {
			selectedBios.push(bio)
		}
	}

	if (selectedBios.length > 0) {
		return selectedBios[0]
	}

	return bios[0]
}

export async function profileImage(
	author: Author
): Promise<AuthorProfileImage> {
	const uuid = author.profileImage
	if (uuid == null) return null

	let tableObject = await getTableObject(uuid)
	if (tableObject == null) return null

	return convertTableObjectToAuthorProfileImage(tableObject)
}

export async function bios(
	author: Author,
	args: { limit?: number; offset?: number }
): Promise<List<AuthorBio>> {
	let bioUuidsString = author.bios

	if (bioUuidsString == null) {
		return {
			total: 0,
			items: []
		}
	}

	let limit = args.limit || 10
	if (limit <= 0) limit = 10

	let offset = args.offset || 0
	if (offset < 0) offset = 0

	let bioUuids = bioUuidsString.split(",")
	let bios: AuthorBio[] = []

	for (let uuid of bioUuids) {
		let tableObject = await getTableObject(uuid)
		if (tableObject == null) continue

		bios.push(convertTableObjectToAuthorBio(tableObject))
	}

	return {
		total: bios.length,
		items: bios.slice(offset, limit + offset)
	}
}

export async function collections(
	author: Author,
	args: { limit?: number; offset?: number }
): Promise<List<StoreBookCollection>> {
	let collectionUuidsString = author.collections

	if (collectionUuidsString == null) {
		return {
			total: 0,
			items: []
		}
	}

	let limit = args.limit || 10
	if (limit <= 0) limit = 10

	let offset = args.offset || 0
	if (offset < 0) offset = 0

	let collectionUuids = collectionUuidsString.split(",")
	let collections: StoreBookCollection[] = []

	for (let uuid of collectionUuids) {
		let tableObject = await getTableObject(uuid)
		if (tableObject == null) continue

		collections.push(convertTableObjectToStoreBookCollection(tableObject))
	}

	return {
		total: collections.length,
		items: collections.slice(offset, limit + offset)
	}
}

export async function series(
	author: Author,
	args: { limit?: number; offset?: number }
): Promise<List<StoreBookSeries>> {
	let seriesUuidsString = author.series

	if (seriesUuidsString == null) {
		return {
			total: 0,
			items: []
		}
	}

	let limit = args.limit || 10
	if (limit <= 0) limit = 10

	let offset = args.offset || 0
	if (offset < 0) offset = 0

	let seriesUuids = seriesUuidsString.split(",")
	let series: StoreBookSeries[] = []

	for (let uuid of seriesUuids) {
		let tableObject = await getTableObject(uuid)
		if (tableObject == null) continue

		series.push(convertTableObjectToStoreBookSeries(tableObject))
	}

	return {
		total: series.length,
		items: series.slice(offset, limit + offset)
	}
}
