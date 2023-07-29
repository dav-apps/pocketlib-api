import {
	isSuccessStatusCode,
	ApiResponse,
	TableObjectsController
} from "dav-js"
import {
	ResolverContext,
	List,
	TableObject,
	StoreBookSeries,
	StoreBook
} from "../types.js"
import {
	throwApiError,
	throwValidationError,
	loadStoreBookData,
	convertTableObjectToStoreBookSeries,
	convertTableObjectToStoreBook
} from "../utils.js"
import { admins, storeBookSeriesTableId } from "../constants.js"
import { apiErrors, validationErrors } from "../errors.js"
import {
	getTableObject,
	listTableObjects,
	addTableObjectToCollection
} from "../services/apiService.js"
import {
	validateNameLength,
	validateLanguage
} from "../services/validationService.js"

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

export async function createStoreBookSeries(
	parent: any,
	args: {
		author?: string
		name: string
		language: string
		storeBooks?: string[]
	},
	context: ResolverContext
): Promise<StoreBookSeries> {
	const user = context.user
	const accessToken = context.token
	const isAdmin = admins.includes(user.id)

	// Validate the args
	throwValidationError(
		validateNameLength(args.name),
		validateLanguage(args.language)
	)

	let authorTableObject: TableObject = null

	if (isAdmin) {
		if (args.author == null) {
			throwValidationError(validationErrors.authorRequired)
		}

		authorTableObject = await getTableObject(args.author)

		if (authorTableObject == null) {
			throwApiError(apiErrors.authorDoesNotExist)
		}
	} else {
		// Get the author of the user
		let response = await listTableObjects({
			caching: false,
			limit: 1,
			tableName: "Author",
			userId: user.id
		})

		if (response.items.length > 0) {
			authorTableObject = response.items[0]
		} else {
			throwApiError(apiErrors.actionNotAllowed)
		}
	}

	validateStoreBooksParam(args.storeBooks, args.language)

	// Create the store book series
	let seriesProperties = {
		name: args.name,
		language: args.language,
		store_books: args.storeBooks.join(",")
	}

	if (args.author != null) {
		seriesProperties["author"] = args.author
	}

	let createSeriesResponse = await TableObjectsController.CreateTableObject({
		accessToken,
		tableId: storeBookSeriesTableId,
		properties: seriesProperties
	})

	if (!isSuccessStatusCode(createSeriesResponse.status)) {
		throwApiError(apiErrors.unexpectedError)
	}

	let createSeriesResponseData = (
		createSeriesResponse as ApiResponse<TableObjectsController.TableObjectResponseData>
	).data

	// Add the store book to the latest series collection
	let collection = await addTableObjectToCollection({
		name: "latest_series",
		uuid: createSeriesResponseData.tableObject.Uuid,
		tableId: storeBookSeriesTableId
	})

	if (collection == null) {
		throwApiError(apiErrors.unexpectedError)
	}

	return {
		uuid: createSeriesResponseData.tableObject.Uuid,
		author: createSeriesResponseData.tableObject.Properties.author
			.value as string,
		name: createSeriesResponseData.tableObject.Properties.name
			.value as string,
		language: createSeriesResponseData.tableObject.Properties.language
			.value as string,
		storeBooks: createSeriesResponseData.tableObject.Properties.store_books
			.value as string
	}
}

export async function updateStoreBookSeries(
	parent: any,
	args: {
		uuid: string
		name?: string
		storeBooks?: string[]
	},
	context: ResolverContext
): Promise<StoreBookSeries> {
	const uuid = args.uuid
	if (uuid == null) return null

	const user = context.user
	const accessToken = context.token
	const isAdmin = admins.includes(user.id)

	// Get the store book series
	let storeBookSeriesTableObject = await getTableObject(args.uuid)

	if (storeBookSeriesTableObject == null) {
		throwApiError(apiErrors.storeBookSeriesDoesNotExist)
	}

	// Check if the store book series belongs to the user
	if (!isAdmin && storeBookSeriesTableObject.userId != user.id) {
		throwApiError(apiErrors.actionNotAllowed)
	}

	// Validate the args
	if (args.name == null && args.storeBooks == null) {
		return convertTableObjectToStoreBookSeries(storeBookSeriesTableObject)
	}

	if (args.name != null) {
		throwValidationError(validateNameLength(args.name))
	}

	validateStoreBooksParam(
		args.storeBooks,
		storeBookSeriesTableObject.properties.language as string
	)

	// Update the store book series
	let updatedSeriesProperties = {}

	if (args.name != null) {
		updatedSeriesProperties["name"] = args.name
		storeBookSeriesTableObject.properties.name = args.name
	}

	if (args.storeBooks != null) {
		updatedSeriesProperties["store_books"] = args.storeBooks.join(",")
		storeBookSeriesTableObject.properties.store_books =
			args.storeBooks.join(",")
	}

	let updateSeriesResponse = await TableObjectsController.UpdateTableObject({
		accessToken,
		uuid: storeBookSeriesTableObject.uuid,
		properties: updatedSeriesProperties
	})

	if (!isSuccessStatusCode(updateSeriesResponse.status)) {
		throwApiError(apiErrors.unexpectedError)
	}

	return convertTableObjectToStoreBookSeries(storeBookSeriesTableObject)
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

//#region Helper functions
async function validateStoreBooksParam(storeBooks: string[], language: string) {
	if (storeBooks == null) return

	for (let uuid of storeBooks) {
		// Get the store book
		let storeBook = await getTableObject(uuid)

		if (storeBook == null) {
			throwApiError(apiErrors.storeBookDoesNotExist)
		}

		if (storeBook.properties.language != language) {
			throwApiError(apiErrors.storeBookLanguageNotMatching)
		}
	}
}
//#endregion
