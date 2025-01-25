import {
	isSuccessStatusCode,
	ApiResponse,
	TableObjectsController,
	PurchasesController,
	Plan,
	TableObject
} from "dav-js"
import { ResolverContext, StoreBook, Book } from "../types.js"
import { throwApiError, getLastReleaseOfStoreBook } from "../utils.js"
import { apiErrors } from "../errors.js"
import { admins, bookTableId, bookFileTableId } from "../constants.js"
import {
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
	const accessToken = context.accessToken

	// Check if the user is logged in
	if (user == null) {
		throwApiError(apiErrors.notAuthenticated)
	}

	const isAdmin = admins.includes(user.Id)

	// Copy the store book into the library by creating a book with the file of the store book
	// Get the store book
	let storeBook = (await context.prisma.storeBook.findFirst({
		where: { uuid: args.storeBook }
	})) as StoreBook

	if (storeBook == null) {
		throwApiError(apiErrors.storeBookDoesNotExist)
	}

	// Get the latest store book release
	let storeBookRelease = await getLastReleaseOfStoreBook(
		context.prisma,
		storeBook.id,
		true
	)

	if (storeBookRelease == null) {
		throwApiError(apiErrors.unexpectedError)
	} else if (
		storeBook.status != "published" ||
		storeBookRelease.status != "published"
	) {
		throwApiError(apiErrors.storeBookNotPublished)
	}

	// Check if the user has purchased the table object
	let purchases = await listPurchasesOfTableObject({
		uuid: storeBook.uuid,
		userId: user.Id
	})

	if (purchases.length == 0) {
		// Check if the user is an admin or the author of the store book
		const isAuthor = storeBook.userId == BigInt(user.Id)

		if (!isAdmin && !isAuthor) {
			let storeBookStatus = storeBook.status || "unpublished"
			let storeBookReleaseStatus = storeBookRelease.status || "unpublished"

			// Check if the user can access the store book
			if (
				storeBookStatus != "published" ||
				storeBookReleaseStatus != "published"
			) {
				throwApiError(apiErrors.actionNotAllowed)
			}

			// Check if the store book is free
			let storeBookPrice = storeBook.price || 0

			if (storeBookPrice == 0) {
				// Create a purchase for the store book
				let createPurchaseResponse =
					await PurchasesController.createPurchase(`uuid`, {
						accessToken,
						tableObjectUuid: storeBook.uuid
					})

				if (
					Array.isArray(createPurchaseResponse) &&
					createPurchaseResponse.includes("SESSION_EXPIRED")
				) {
					throwApiError(apiErrors.unexpectedError)
				}
			} else if (user.Plan != Plan.Pro) {
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
		userId: user.Id,
		propertyName: "store_book",
		propertyValue: storeBook.uuid,
		exact: true
	})

	if (tableObjectsInLibrary.items.length > 0) {
		throwApiError(apiErrors.storeBookAlreadyInLibrary)
	}

	// Get the store book file
	let file = await context.prisma.storeBookFile.findFirst({
		where: { id: storeBookRelease.fileId }
	})

	if (file == null) {
		throwApiError(apiErrors.unexpectedError)
	}

	// Get the store book file table object
	let retrieveStoreBookFileTableObjectResponse =
		await TableObjectsController.retrieveTableObject(``, { uuid: file.uuid })

	if (Array.isArray(retrieveStoreBookFileTableObjectResponse)) {
		throwApiError(apiErrors.unexpectedError)
	}

	let storeBookFileTableObject =
		retrieveStoreBookFileTableObjectResponse as TableObject
	let bookType = storeBookFileTableObject.Properties.type.value as string

	// Create the book
	let bookProperties = {
		store_book: storeBook.uuid,
		file: storeBookFileTableObject.Uuid
	}

	if (bookType == "application/pdf") {
		bookProperties["title"] = storeBookRelease.title
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
		uuid: file.uuid,
		tableAlias: bookFileTableId
	})

	if (addTableObjectResponse == null) {
		throwApiError(apiErrors.unexpectedError)
	}

	return {
		uuid: createBookResponseData.tableObject.Uuid,
		storeBook: storeBook.uuid,
		file: file.uuid
	}
}
