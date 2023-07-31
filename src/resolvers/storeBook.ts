import {
	isSuccessStatusCode,
	ApiResponse,
	TableObjectsController
} from "dav-js"
import {
	ResolverContext,
	List,
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
	throwValidationError,
	loadStoreBookData,
	createNewStoreBookRelease,
	convertTableObjectToStoreBookCollection,
	convertTableObjectToStoreBookSeries,
	convertTableObjectToStoreBook,
	convertTableObjectToStoreBookRelease,
	convertTableObjectToStoreBookCover,
	convertTableObjectToStoreBookFile,
	convertTableObjectToCategory
} from "../utils.js"
import { apiErrors, validationErrors } from "../errors.js"
import {
	admins,
	storeBookCollectionTableId,
	storeBookCollectionNameTableId,
	storeBookTableId,
	storeBookReleaseTableId
} from "../constants.js"
import {
	getTableObject,
	listTableObjects,
	listPurchasesOfTableObject,
	setTableObjectPrice,
	addTableObjectToCollection
} from "../services/apiService.js"
import {
	validateTitleLength,
	validateDescriptionLength,
	validateCategoriesLength,
	validateLanguage,
	validatePrice,
	validateIsbn,
	validateStatus
} from "../services/validationService.js"

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
	context: ResolverContext
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
		const user = context.user

		if (user == null) {
			throwApiError(apiErrors.notAuthenticated)
		} else if (!admins.includes(user.id)) {
			throwApiError(apiErrors.actionNotAllowed)
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

export async function createStoreBook(
	parent: any,
	args: {
		author?: string
		collection?: string
		title: string
		description?: string
		language: string
		price?: number
		isbn?: string
		categories?: string[]
	},
	context: ResolverContext
): Promise<StoreBook> {
	const user = context.user
	const accessToken = context.accessToken

	// Check if the user is logged in
	if (user == null) {
		throwApiError(apiErrors.notAuthenticated)
	}

	let isAdmin = admins.includes(user.id)
	let authorTableObject: TableObject = null

	if (isAdmin) {
		if (args.author == null) {
			throwValidationError(validationErrors.authorRequired)
		}

		// Get the author
		authorTableObject = await getTableObject(args.author)

		if (authorTableObject == null) {
			throwApiError(apiErrors.authorDoesNotExist)
		}
	} else {
		// Check if the user is an author
		let response = await listTableObjects({
			caching: false,
			limit: 1,
			tableName: "Author",
			userId: user.id
		})

		if (response.items.length == 0) {
			throwApiError(apiErrors.actionNotAllowed)
		} else {
			authorTableObject = response.items[0]
		}
	}

	// Validate the args
	let errors: string[] = [validateTitleLength(args.title)]

	if (args.description != null) {
		errors.push(validateDescriptionLength(args.description))
	}

	errors.push(validateLanguage(args.language))

	if (args.price != null) {
		errors.push(validatePrice(args.price))
	}

	if (args.isbn != null) {
		errors.push(validateIsbn(args.isbn))
	}

	if (args.categories != null) {
		errors.push(validateCategoriesLength(args.categories))
	}

	throwValidationError(...errors)

	let storeBookCollection: TableObject = null

	if (args.collection == null) {
		// Create the store book collection name
		let createCollectionNameResponse =
			await TableObjectsController.CreateTableObject({
				accessToken,
				tableId: storeBookCollectionNameTableId,
				properties: {
					name: args.title,
					language: args.language
				}
			})

		if (!isSuccessStatusCode(createCollectionNameResponse.status)) {
			throwApiError(apiErrors.unexpectedError)
		}

		let createCollectionNameResponseData = (
			createCollectionNameResponse as ApiResponse<TableObjectsController.TableObjectResponseData>
		).data

		// Create the store book collection
		let createCollectionResponse =
			await TableObjectsController.CreateTableObject({
				accessToken,
				tableId: storeBookCollectionTableId,
				properties: {
					author: authorTableObject.uuid,
					names: createCollectionNameResponseData.tableObject.Uuid
				}
			})

		if (!isSuccessStatusCode(createCollectionResponse.status)) {
			throwApiError(apiErrors.unexpectedError)
		}

		let createCollectionResponseData = (
			createCollectionResponse as ApiResponse<TableObjectsController.TableObjectResponseData>
		).data

		// Update the author with the new collection
		let authorCollectionsString = authorTableObject.properties
			.collections as string

		if (
			authorCollectionsString == null ||
			authorCollectionsString.length == 0
		) {
			authorCollectionsString = createCollectionResponseData.tableObject.Uuid
		} else {
			authorCollectionsString += `,${createCollectionResponseData.tableObject.Uuid}`
		}

		let updateAuthorResponse = await TableObjectsController.UpdateTableObject(
			{
				accessToken,
				uuid: authorTableObject.uuid,
				properties: {
					collections: authorCollectionsString
				}
			}
		)

		if (!isSuccessStatusCode(updateAuthorResponse.status)) {
			throwApiError(apiErrors.unexpectedError)
		}

		storeBookCollection = {
			uuid: createCollectionResponseData.tableObject.Uuid,
			tableId: createCollectionResponseData.tableObject.TableId,
			userId: user.id,
			properties: {}
		}

		for (let key of Object.keys(
			createCollectionResponseData.tableObject.Properties
		)) {
			let value = createCollectionResponseData.tableObject.Properties[key]
			storeBookCollection.properties[key] = value.value
		}
	} else {
		// Get the collection
		storeBookCollection = await getTableObject(args.collection)

		if (storeBookCollection == null) {
			throwApiError(apiErrors.storeBookCollectionDoesNotExist)
		}

		// Check if the collection already has a name for the given language
		let namesString = storeBookCollection.properties.names as string
		let createCollectionName = true

		if (namesString != null) {
			let nameUuids = namesString.split(",")

			for (let nameUuid of nameUuids) {
				// Get the store book collection name table object
				let nameObj = await getTableObject(nameUuid)
				if (nameObj == null) continue

				if (nameObj.properties.language == args.language) {
					createCollectionName = false
				}
			}
		}

		if (createCollectionName) {
			// Create the store book collection name
			let createCollectionNameResponse =
				await TableObjectsController.CreateTableObject({
					accessToken,
					tableId: storeBookCollectionNameTableId,
					properties: {
						name: args.title,
						language: args.language
					}
				})

			if (!isSuccessStatusCode(createCollectionNameResponse.status)) {
				throwApiError(apiErrors.unexpectedError)
			}

			let createCollectionNameResponseData = (
				createCollectionNameResponse as ApiResponse<TableObjectsController.TableObjectResponseData>
			).data

			// Add the uuid of the new name to the names of the collection
			if (namesString == null || namesString.length == 0) {
				namesString = createCollectionNameResponseData.tableObject.Uuid
			} else {
				namesString += `,${createCollectionNameResponseData.tableObject.Uuid}`
			}

			// Update the collection with the new names
			await TableObjectsController.UpdateTableObject({
				accessToken,
				uuid: storeBookCollection.uuid,
				properties: {
					names: namesString
				}
			})
		}
	}

	// Create the store book release
	let storeBookReleaseProperties = {
		title: args.title
	}

	if (args.description != null) {
		storeBookReleaseProperties["description"] = args.description
	}

	if (args.price != null) {
		storeBookReleaseProperties["price"] = args.price
	}

	if (args.isbn != null) {
		storeBookReleaseProperties["isbn"] = args.isbn
	}

	if (args.categories != null) {
		// Get the category uuids
		let categoryUuids = await getCategoryUuids(args.categories)

		if (categoryUuids.length > 0) {
			storeBookReleaseProperties["categories"] = categoryUuids.join(",")
		}
	}

	let createStoreBookReleaseResponse =
		await TableObjectsController.CreateTableObject({
			accessToken,
			tableId: storeBookReleaseTableId,
			properties: storeBookReleaseProperties
		})

	if (!isSuccessStatusCode(createStoreBookReleaseResponse.status)) {
		throwApiError(apiErrors.unexpectedError)
	}

	let createStoreBookReleaseResponseData = (
		createStoreBookReleaseResponse as ApiResponse<TableObjectsController.TableObjectResponseData>
	).data

	// Create the store book table object
	let createStoreBookResponse = await TableObjectsController.CreateTableObject(
		{
			accessToken,
			tableId: storeBookTableId,
			properties: {
				collection: storeBookCollection.uuid,
				releases: createStoreBookReleaseResponseData.tableObject.Uuid,
				language: args.language
			}
		}
	)

	if (!isSuccessStatusCode(createStoreBookResponse.status)) {
		throwApiError(apiErrors.unexpectedError)
	}

	let createStoreBookResponseData = (
		createStoreBookResponse as ApiResponse<TableObjectsController.TableObjectResponseData>
	).data
	let storeBookTableObject = createStoreBookResponseData.tableObject

	// Set the price of the table object
	let storeBookPrice = await setTableObjectPrice({
		uuid: storeBookTableObject.Uuid,
		price: args.price || 0,
		currency: "eur"
	})

	if (storeBookPrice == null) {
		throwApiError(apiErrors.unexpectedError)
	}

	// Add the store book to the books of the store book collection
	let booksString = storeBookCollection.properties.books as string

	if (booksString == null || booksString.length == 0) {
		booksString = storeBookTableObject.Uuid
	} else {
		booksString += `,${storeBookTableObject.Uuid}`
	}

	let updateStoreBookCollectionResponse =
		await TableObjectsController.UpdateTableObject({
			accessToken,
			uuid: storeBookCollection.uuid,
			properties: {
				books: booksString
			}
		})

	if (!isSuccessStatusCode(updateStoreBookCollectionResponse.status)) {
		throwApiError(apiErrors.unexpectedError)
	}

	// Add the store book to the release
	let updateStoreBookReleaseResponse =
		await TableObjectsController.UpdateTableObject({
			accessToken,
			uuid: createStoreBookReleaseResponseData.tableObject.Uuid,
			properties: {
				store_book: storeBookTableObject.Uuid
			}
		})

	if (!isSuccessStatusCode(updateStoreBookReleaseResponse.status)) {
		throwApiError(apiErrors.unexpectedError)
	}

	return {
		uuid: storeBookTableObject.Uuid,
		collection: storeBookCollection.uuid,
		title: args.title,
		description: args.description,
		language: args.language,
		price: args.price || 0,
		isbn: args.isbn,
		status: "unpublished",
		cover: null,
		file: null,
		categories: null,
		releases: createStoreBookReleaseResponseData.tableObject.Uuid,
		inLibrary: false,
		purchased: false
	}
}

export async function updateStoreBook(
	parent: any,
	args: {
		uuid: string
		title?: string
		description?: string
		language?: string
		price?: number
		isbn?: string
		status?: string
		categories?: string[]
	},
	context: ResolverContext
): Promise<StoreBook> {
	const uuid = args.uuid
	if (uuid == null) return null

	const accessToken = context.accessToken
	const user = context.user

	if (user == null) {
		throwApiError(apiErrors.notAuthenticated)
	}

	const isAdmin = admins.includes(user.id)

	// Get the store book
	let storeBookTableObject = await getTableObject(uuid)

	if (storeBookTableObject == null) {
		throwApiError(apiErrors.storeBookDoesNotExist)
	}

	// Check if the store book belongs to the user
	if (!isAdmin && storeBookTableObject.userId != user.id) {
		throwApiError(apiErrors.actionNotAllowed)
	}

	// Get the latest release
	let releaseUuidsString = storeBookTableObject.properties.releases as string

	if (releaseUuidsString == null) {
		throwApiError(apiErrors.unexpectedError)
	}

	let releaseUuids = releaseUuidsString.split(",").reverse()

	if (releaseUuids.length == 0) {
		throwApiError(apiErrors.unexpectedError)
	}

	let storeBookReleaseTableObject = await getTableObject(releaseUuids[0])

	if (storeBookReleaseTableObject == null) {
		throwApiError(apiErrors.storeBookReleaseDoesNotExist)
	}

	// Get the collection
	let collectionUuid = storeBookTableObject.properties.collection as string

	if (collectionUuid == null) {
		throwApiError(apiErrors.unexpectedError)
	}

	let collectionTableObject = await getTableObject(collectionUuid)

	if (collectionTableObject == null) {
		throwApiError(apiErrors.storeBookCollectionDoesNotExist)
	}

	// Validate the args
	if (
		args.title == null &&
		args.description == null &&
		args.language == null &&
		args.price == null &&
		args.isbn == null &&
		args.status == null &&
		args.categories == null
	) {
		let storeBook = convertTableObjectToStoreBook(storeBookTableObject)
		await loadStoreBookData(storeBook)
		return storeBook
	}

	let errors: string[] = []

	if (args.title != null) {
		errors.push(validateTitleLength(args.title))
	}

	if (args.description != null) {
		errors.push(validateDescriptionLength(args.description))
	}

	if (args.language != null) {
		errors.push(validateLanguage(args.language))
	}

	if (args.price != null) {
		errors.push(validatePrice(args.price))
	}

	if (args.isbn != null) {
		errors.push(validateIsbn(args.isbn))
	}

	if (args.status != null) {
		errors.push(validateStatus(args.status))
	}

	if (args.categories != null) {
		errors.push(validateCategoriesLength(args.categories))
	}

	throwValidationError(...errors)

	// Don't update language if the StoreBook is already published
	if (
		(storeBookTableObject.properties.status == "published" ||
			storeBookTableObject.properties.status == "hidden") &&
		args.language != null
	) {
		throwApiError(apiErrors.cannotUpdateStoreBookLanguage)
	}

	// Check if the store book release is already published
	if (storeBookReleaseTableObject.properties.status == "published") {
		// Create a new release
		let createReleaseResponse = await createNewStoreBookRelease(
			accessToken,
			storeBookTableObject,
			storeBookReleaseTableObject
		)

		if (!isSuccessStatusCode(createReleaseResponse.status)) {
			throwApiError(apiErrors.unexpectedError)
		}

		let createReleaseResponseData = (
			createReleaseResponse as ApiResponse<TableObjectsController.TableObjectResponseData>
		).data

		// Add the new release to the releases of the store book
		releaseUuidsString += `,${createReleaseResponseData.tableObject.Uuid}`

		// Update the release object with the data of the new release
		storeBookReleaseTableObject = {
			uuid: createReleaseResponseData.tableObject.Uuid,
			userId: user.id,
			tableId: createReleaseResponseData.tableObject.TableId,
			properties: {}
		}

		for (let key of Object.keys(
			createReleaseResponseData.tableObject.Properties
		)) {
			let value = createReleaseResponseData.tableObject.Properties[key]
			storeBookReleaseTableObject.properties[key] = value.value
		}
	}

	if (args.language != null) {
		// Update the store book with releases and new language
		let updateStoreBookResponse =
			await TableObjectsController.UpdateTableObject({
				accessToken,
				uuid: storeBookTableObject.uuid,
				properties: {
					releases: releaseUuidsString,
					language: args.language
				}
			})

		if (!isSuccessStatusCode(updateStoreBookResponse.status)) {
			throwApiError(apiErrors.unexpectedError)
		}
	}

	// Update the release with the new values
	let newReleaseProperties = {}

	if (args.title != null) {
		newReleaseProperties["title"] = args.title
	}

	if (args.description != null) {
		newReleaseProperties["description"] = args.description
	}

	if (args.price != null) {
		newReleaseProperties["price"] = args.price
	}

	if (args.isbn != null) {
		newReleaseProperties["isbn"] = args.isbn.length == 0 ? null : args.isbn
	}

	// Check if the new status is compatible with the old status
	if (args.status != null) {
		let oldStatus = storeBookReleaseTableObject.properties.status
		let newStoreBookStatus = null

		if (isAdmin) {
			if (
				((oldStatus == null ||
					oldStatus == "unpublished" ||
					oldStatus == "review") &&
					args.status == "hidden") ||
				args.status == "published"
			) {
				checkPropertiesForPublishing(storeBookReleaseTableObject)
			}

			// Update the status
			newStoreBookStatus = args.status

			if (args.status == "published") {
				// Set the status of the release to "published"
				newReleaseProperties["status"] = "published"

				// Add the store book to the latest store books collection
				let collection = await addTableObjectToCollection({
					name: "latest_books",
					uuid: storeBookTableObject.uuid,
					tableId: storeBookTableId
				})

				if (collection == null) {
					throwApiError(apiErrors.unexpectedError)
				}
			}
		} else {
			if (
				(storeBookTableObject.properties.status == null ||
					storeBookTableObject.properties.status == "unpublished") &&
				args.status == "review"
			) {
				// Check if the store book can be published
				checkPropertiesForPublishing(storeBookReleaseTableObject)

				// Change the status of the store book to "review"
				newStoreBookStatus = "review"
			} else if (
				storeBookTableObject.properties.status == "review" &&
				args.status == "unpublished"
			) {
				// Change the status of the book to "unpublished"
				newStoreBookStatus = "unpublished"
			} else if (
				storeBookTableObject.properties.status == "hidden" &&
				args.status == "published"
			) {
				// Change the status of the book to "published"
				newStoreBookStatus = "published"
			} else if (
				storeBookTableObject.properties.status == "published" &&
				args.status == "hidden"
			) {
				// Change the status of the book to "hidden"
				newStoreBookStatus = "hidden"
			} else {
				throwApiError(apiErrors.actionNotAllowed)
			}
		}

		if (newStoreBookStatus != null) {
			// Update the store book with the new status
			let updateStoreBookResponse =
				await TableObjectsController.UpdateTableObject({
					accessToken,
					uuid: storeBookTableObject.uuid,
					properties: {
						status: newStoreBookStatus
					}
				})

			if (!isSuccessStatusCode(updateStoreBookResponse.status)) {
				throwApiError(apiErrors.unexpectedError)
			}
		}
	}

	if (args.categories != null) {
		// Get the category uuids
		let categoryUuids = await getCategoryUuids(args.categories)

		if (categoryUuids.length > 0) {
			newReleaseProperties["categories"] = categoryUuids.join(",")
		} else {
			newReleaseProperties["categories"] = null
		}
	}

	// Update the release
	let storeBookReleaseUpdateResponse =
		await TableObjectsController.UpdateTableObject({
			accessToken,
			uuid: storeBookReleaseTableObject.uuid,
			properties: newReleaseProperties
		})

	if (!isSuccessStatusCode(storeBookReleaseUpdateResponse.status)) {
		throwApiError(apiErrors.unexpectedError)
	}

	if (args.price != null) {
		// Set the store book price
		let updatedStoreBookPrice = await setTableObjectPrice({
			uuid: storeBookTableObject.uuid,
			price: args.price,
			currency: "eur"
		})

		if (updatedStoreBookPrice == null) {
			throwApiError(apiErrors.unexpectedError)
		}
	}

	let storeBook = convertTableObjectToStoreBook(storeBookTableObject)
	await loadStoreBookData(storeBook)
	return storeBook
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

//#region Helper functions
function checkPropertiesForPublishing(storeBookRelease: TableObject) {
	let errors = []

	if (storeBookRelease.properties.description == null) {
		errors.push(validationErrors.cannotPublishStoreBookWithoutDescription)
	}

	if (storeBookRelease.properties.cover == null) {
		errors.push(validationErrors.cannotPublishStoreBookWithoutCover)
	}

	if (storeBookRelease.properties.file == null) {
		errors.push(validationErrors.cannotPublishStoreBookWithoutFile)
	}

	throwValidationError(...errors)
}

async function getCategoryUuids(categoryKeys: string[]): Promise<string[]> {
	let categoryUuids: string[] = []

	for (let categoryKey of categoryKeys) {
		let categoryResponse = await listTableObjects({
			limit: 1,
			tableName: "Collection",
			propertyName: "key",
			propertyValue: categoryKey,
			exact: true
		})

		if (categoryResponse.items.length > 0) {
			categoryUuids.push(categoryResponse.items[0].uuid)
		}
	}

	return categoryUuids
}
//#endregion
