import {
	ResolverContext,
	List,
	User,
	TableObject,
	StoreBookCollection,
	StoreBookSeries,
	StoreBook,
	StoreBookRelease,
	StoreBookCover,
	StoreBookFile,
	Category
} from "../types.js"
import {
	throwApiError,
	loadStoreBookData,
	convertTableObjectToStoreBookCollection,
	convertTableObjectToStoreBookSeries,
	convertTableObjectToStoreBook,
	convertTableObjectToStoreBookRelease,
	convertTableObjectToStoreBookCover,
	convertTableObjectToStoreBookFile,
	convertTableObjectToCategory
} from "../utils.js"
import * as Errors from "../errors.js"
import { admins } from "../constants.js"
import {
	getTableObject,
	listTableObjects,
	listPurchasesOfTableObject
} from "../services/apiService.js"

export async function retrieveStoreBook(
	parent: any,
	args: { uuid: string }
): Promise<StoreBook> {
	const uuid = args.uuid
	if (uuid == null) return null

	let tableObject = await getTableObject(uuid)
	if (tableObject == null) return null

	const storeBook = convertTableObjectToStoreBook(tableObject)
	await loadStoreBookData(storeBook)
	return storeBook
}

export async function listStoreBooks(
	parent: any,
	args: {
		latest?: boolean
		categories?: string[]
		inReview?: boolean
		languages?: string[]
		limit?: number
		offset?: number
	},
	context: any
): Promise<List<StoreBook>> {
	let tableObjects: TableObject[] = []

	let limit = args.limit || 10
	if (limit <= 0) limit = 10

	let offset = args.offset || 0
	if (offset < 0) offset = 0

	let latest = args.latest || false
	let inReview = args.inReview || false
	let languages = args.languages || ["en"]

	if (latest) {
		let response = await listTableObjects({
			collectionName: "latest_books"
		})

		tableObjects = response.items
	} else if (args.categories != null) {
		let storeBookUuids: string[] = []

		for (let key of args.categories) {
			// Find the category table object
			let categoriesResponse = await listTableObjects({
				tableName: "Category",
				propertyName: "key",
				propertyValue: key,
				exact: true
			})

			if (categoriesResponse.items.length == 0) {
				continue
			}

			let category = categoriesResponse.items[0]

			// Find StoreBookReleases with the category
			let storeBookReleasesResponse = await listTableObjects({
				tableName: "StoreBookRelease",
				propertyName: "categories",
				propertyValue: category.uuid,
				exact: false
			})

			for (let storeBookRelease of storeBookReleasesResponse.items) {
				let storeBookUuid = storeBookRelease.properties.store_book as string
				if (storeBookUuid == null) continue

				// Check if the store book is already in the list
				if (!storeBookUuids.includes(storeBookUuid)) {
					storeBookUuids.push(storeBookUuid)
				}
			}
		}

		for (let uuid of storeBookUuids) {
			let tableObject = await getTableObject(uuid)
			if (tableObject == null) continue

			tableObjects.push(tableObject)
		}
	} else if (inReview) {
		// Check if the user is an admin
		const user: User = context.user

		if (user == null) {
			throwApiError(Errors.notAuthenticated)
		} else if (!admins.includes(user.id)) {
			throwApiError(Errors.actionPermitted)
		}

		// Get the StoreBooks in review
		let response = await listTableObjects({
			caching: false,
			tableName: "StoreBook",
			propertyName: "status",
			propertyValue: "review",
			exact: true
		})

		tableObjects = response.items
	}

	let result: StoreBook[] = []

	for (let obj of tableObjects) {
		let storeBook = convertTableObjectToStoreBook(obj)

		if (languages.includes(storeBook.language)) {
			await loadStoreBookData(storeBook, !inReview)
			result.push(storeBook)
		}
	}

	return {
		total: result.length,
		items: result.slice(offset, limit + offset)
	}
}

export async function collection(
	storeBook: StoreBook
): Promise<StoreBookCollection> {
	const uuid = storeBook.collection
	if (uuid == null) return null

	let tableObject = await getTableObject(uuid)
	if (tableObject == null) return null

	return convertTableObjectToStoreBookCollection(tableObject)
}

export async function cover(storeBook: StoreBook): Promise<StoreBookCover> {
	const uuid = storeBook.cover
	if (uuid == null) return null

	let tableObject = await getTableObject(uuid)
	if (tableObject == null) return null

	return convertTableObjectToStoreBookCover(tableObject)
}

export async function file(storeBook: StoreBook): Promise<StoreBookFile> {
	const uuid = storeBook.file
	if (uuid == null) return null

	let tableObject = await getTableObject(uuid)
	if (tableObject == null) return null

	return convertTableObjectToStoreBookFile(tableObject)
}

export async function categories(
	storeBook: StoreBook,
	args: { limit?: number; offset?: number }
): Promise<List<Category>> {
	let categoryUuidsString = storeBook.categories

	if (categoryUuidsString == null) {
		return {
			total: 0,
			items: []
		}
	}

	let limit = args.limit || 10
	if (limit <= 0) limit = 10

	let offset = args.offset || 0
	if (offset < 0) offset = 0

	let categoryUuids = categoryUuidsString.split(",")
	let categories: Category[] = []

	for (let uuid of categoryUuids) {
		let tableObject = await getTableObject(uuid)
		if (tableObject == null) continue

		categories.push(convertTableObjectToCategory(tableObject))
	}

	return {
		total: categories.length,
		items: categories.slice(offset, limit + offset)
	}
}

export async function series(
	storeBook: StoreBook,
	args: { limit?: number; offset?: number }
): Promise<List<StoreBookSeries>> {
	let response = await listTableObjects({
		tableName: "StoreBookSeries",
		propertyName: "store_books",
		propertyValue: storeBook.uuid
	})

	let limit = args.limit || 10
	if (limit <= 0) limit = 10

	let offset = args.offset || 0
	if (offset < 0) offset = 0

	let series: StoreBookSeries[] = []

	for (let tableObject of response.items) {
		series.push(convertTableObjectToStoreBookSeries(tableObject))
	}

	return {
		total: series.length,
		items: series.slice(offset, limit + offset)
	}
}

export async function releases(
	storeBook: StoreBook,
	args: { limit?: number; offset?: number }
): Promise<List<StoreBookRelease>> {
	let releaseUuidsString = storeBook.releases

	if (releaseUuidsString == null) {
		return {
			total: 0,
			items: []
		}
	}

	let limit = args.limit || 10
	if (limit <= 0) limit = 10

	let offset = args.offset || 0
	if (offset < 0) offset = 0

	let releaseUuids = releaseUuidsString.split(",")
	let releases: StoreBookRelease[] = []

	for (let uuid of releaseUuids) {
		let tableObject = await getTableObject(uuid)
		if (tableObject == null) continue

		releases.push(convertTableObjectToStoreBookRelease(tableObject))
	}

	return {
		total: releases.length,
		items: releases.slice(offset, limit + offset)
	}
}

export async function inLibrary(
	storeBook: StoreBook,
	args: any,
	context: ResolverContext
): Promise<boolean> {
	if (context.user == null) {
		return null
	}

	let response = await listTableObjects({
		caching: false,
		userId: context.user.id,
		tableName: "Book",
		propertyName: "store_book",
		propertyValue: storeBook.uuid,
		exact: true
	})

	return response.items.length > 0
}

export async function purchased(
	storeBook: StoreBook,
	args: any,
	context: ResolverContext
): Promise<boolean> {
	if (context.user == null) {
		return null
	}

	let purchases = await listPurchasesOfTableObject({
		uuid: storeBook.uuid,
		userId: context.user.id
	})

	return purchases.length >= 0
}
