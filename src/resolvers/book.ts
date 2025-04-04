import {
	TableObjectsController,
	PurchasesController,
	TableObjectUserAccessesController,
	Plan,
	Auth,
	List,
	TableObjectResource,
	PurchaseResource
} from "dav-js"
import { ResolverContext, StoreBook, Book } from "../types.js"
import { throwApiError, getLastReleaseOfStoreBook } from "../utils.js"
import { apiErrors } from "../errors.js"
import { appId, admins, bookTableId, bookFileTableId } from "../constants.js"

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
	let listPurchasesOfTableObjectResponse =
		await PurchasesController.listPurchasesOfTableObject(`items { uuid }`, {
			accessToken: context.accessToken,
			uuid: storeBook.uuid
		})

	if (Array.isArray(listPurchasesOfTableObjectResponse)) {
		throwApiError(apiErrors.unexpectedError)
	}

	let purchases = (
		listPurchasesOfTableObjectResponse as List<PurchaseResource>
	).items

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
	let listTableObjectsResponse =
		await TableObjectsController.listTableObjectsByProperty(
			`
				items {
					uuid
				}
			`,
			{
				auth: new Auth({
					apiKey: process.env.DAV_API_KEY,
					secretKey: process.env.DAV_SECRET_KEY,
					uuid: process.env.DAV_UUID
				}),
				userId: user.Id,
				appId,
				tableName: "Book",
				propertyName: "store_book",
				propertyValue: storeBook.uuid,
				exact: true,
				limit: 1
			}
		)

	let listTableObjectsResponseData =
		listTableObjectsResponse as List<TableObjectResource>

	if (
		!Array.isArray(listTableObjectsResponseData) &&
		listTableObjectsResponseData.items.length > 0
	) {
		throwApiError(apiErrors.storeBookAlreadyInLibrary)
	}

	// Get the store book file
	let file = await context.prisma.storeBookFile.findFirst({
		where: { id: storeBookRelease.fileId }
	})

	if (file == null) {
		throwApiError(apiErrors.unexpectedError)
	}

	// Create a TableObjectUserAccess for the file
	let createTableObjectUserAccessResponse =
		await TableObjectUserAccessesController.createTableObjectUserAccess(
			`tableAlias`,
			{
				accessToken,
				tableObjectUuid: file.uuid,
				tableAlias: bookFileTableId
			}
		)

	if (Array.isArray(createTableObjectUserAccessResponse)) {
		throwApiError(apiErrors.unexpectedError)
	}

	// Get the store book file table object
	let retrieveStoreBookFileTableObjectResponse =
		await TableObjectsController.retrieveTableObject(
			`
				uuid
				properties
			`,
			{
				accessToken,
				uuid: file.uuid
			}
		)

	if (Array.isArray(retrieveStoreBookFileTableObjectResponse)) {
		throwApiError(apiErrors.unexpectedError)
	}

	let storeBookFileTableObject =
		retrieveStoreBookFileTableObjectResponse as TableObjectResource
	let bookType = storeBookFileTableObject.properties.type as string

	// Create the book
	let bookProperties = {
		store_book: storeBook.uuid,
		file: storeBookFileTableObject.uuid
	}

	if (bookType == "application/pdf") {
		bookProperties["title"] = storeBookRelease.title
	}

	let createBookResponse = await TableObjectsController.createTableObject(
		`uuid`,
		{
			accessToken,
			tableId: bookTableId,
			properties: bookProperties
		}
	)

	if (Array.isArray(createBookResponse)) {
		throwApiError(apiErrors.unexpectedError)
	}

	let createBookResponseData = createBookResponse as TableObjectResource

	return {
		uuid: createBookResponseData.uuid,
		storeBook: storeBook.uuid,
		file: file.uuid
	}
}
