import {
	isSuccessStatusCode,
	ApiResponse,
	TableObjectsController
} from "dav-js"
import { ResolverContext, TableObject, Book } from "../types.js"
import { throwApiError, getLastReleaseOfStoreBook } from "../utils.js"
import { apiErrors } from "../errors.js"
import { admins, bookTableId, bookFileTableId } from "../constants.js"
import {
	getTableObject,
	listTableObjects,
	listPurchasesOfTableObject,
	addTableObject
} from "../services/apiService.js"

export async function createBook(
	parent: any,
	args: { storeBook: string },
	context: ResolverContext
): Promise<Book> {
	const user = context.user
	const accessToken = context.token

	// Check if the user is logged in
	if (user == null) {
		throwApiError(apiErrors.notAuthenticated)
	}

	const isAdmin = admins.includes(user.id)

	// Copy the store book into the library by creating a book with the file of the store book
	// Get the store book
	let storeBookTableObject = await getTableObject(args.storeBook)

	if (storeBookTableObject == null) {
		throwApiError(apiErrors.storeBookDoesNotExist)
	}

	// Get the latest store book release
	let storeBookReleaseTableObject: TableObject =
		await getLastReleaseOfStoreBook(storeBookTableObject, true)

	if (storeBookReleaseTableObject == null) {
		throwApiError(apiErrors.unexpectedError)
	} else if (
		storeBookTableObject.properties.status != "published" ||
		storeBookReleaseTableObject.properties.status != "published"
	) {
		throwApiError(apiErrors.storeBookNotPublished)
	}

	// Check if the user has purchased the table object
	let purchases = await listPurchasesOfTableObject({
		uuid: storeBookTableObject.uuid,
		userId: user.id
	})

	if (purchases.length == 0) {
		// Check if the user is an admin or the author of the store book
		const isAuthor = storeBookTableObject.userId == user.id

		if (!isAdmin && !isAuthor) {
			let storeBookStatus =
				(storeBookTableObject.properties.status as string) || "unpublished"
			let storeBookReleaseStatus =
				(storeBookReleaseTableObject.properties.status as string) ||
				"unpublished"

			// Check if the user can access the store book
			if (
				storeBookStatus != "published" ||
				storeBookReleaseStatus != "published"
			) {
				throwApiError(apiErrors.actionNotAllowed)
			}

			// Check if the store book is free
			let storeBookPrice =
				(storeBookTableObject.properties.price as number) || 0

			if (storeBookPrice == 0) {
				throwApiError(
					apiErrors.cannotAddFreeStoreBookToLibraryWithoutPurchase
				)
			}

			// Check if the user is on the Pro plan
			if (user.plan < 2) {
				throwApiError(apiErrors.davProRequired)
			}
		}
	}

	// The user can add the store book to the library
	// Check if the store book is already in the library of the user
	let tableObjectsInLibrary = await listTableObjects({
		caching: false,
		limit: 1,
		tableName: "Book",
		userId: user.id,
		propertyName: "store_book",
		propertyValue: storeBookTableObject.uuid,
		exact: true
	})

	if (tableObjectsInLibrary.items.length > 0) {
		throwApiError(apiErrors.storeBookAlreadyInLibrary)
	}

	// Get the table object of the store book file
	let fileUuid = storeBookTableObject.properties.file as string

	if (fileUuid == null) {
		throwApiError(apiErrors.unexpectedError)
	}

	let storeBookFileTableObject = await getTableObject(fileUuid)

	if (storeBookFileTableObject == null) {
		throwApiError(apiErrors.unexpectedError)
	}

	let bookType = storeBookFileTableObject.properties.type as string

	// Create the book
	let bookProperties = {
		store_book: storeBookTableObject.uuid,
		file: storeBookFileTableObject.uuid
	}

	if (bookType == "application/pdf") {
		bookProperties["title"] = storeBookReleaseTableObject.properties
			.title as string
	}

	let createBookResponse = await TableObjectsController.CreateTableObject({
		accessToken,
		tableId: bookTableId,
		properties: bookProperties
	})

	if (!isSuccessStatusCode(createBookResponse.status)) {
		throwApiError(apiErrors.unexpectedError)
	}

	let createBookResponseData = (
		createBookResponse as ApiResponse<TableObjectsController.TableObjectResponseData>
	).data

	// Create a TableObjectUserAccess for the file
	let addTableObjectResponse = await addTableObject({
		accessToken,
		uuid: storeBookFileTableObject.uuid,
		tableAlias: bookFileTableId
	})

	if (addTableObjectResponse == null) {
		throwApiError(apiErrors.unexpectedError)
	}

	return {
		uuid: createBookResponseData.tableObject.Uuid,
		storeBook: storeBookTableObject.uuid,
		file: storeBookFileTableObject.uuid
	}
}
