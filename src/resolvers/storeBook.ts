import {
	Prisma,
	PrismaClient,
	Author,
	StoreBookRelease,
	StoreBookCollection,
	StoreBookFile,
	StoreBookPrintCover,
	StoreBookPrintFile,
	StoreBookSeries,
	Category
} from "@prisma/client"
import * as crypto from "crypto"
import { isSuccessStatusCode, TableObjectsController } from "dav-js"
import { ResolverContext, List, StoreBook, StoreBookCover } from "../types.js"
import {
	throwApiError,
	throwValidationError,
	loadStoreBookData,
	getLastReleaseOfStoreBook,
	createNewStoreBookRelease,
	getTableObjectFileUrl,
	randomNumber
} from "../utils.js"
import { apiErrors, validationErrors } from "../errors.js"
import { admins, storeBookTableId } from "../constants.js"
import {
	listTableObjects,
	listPurchasesOfTableObject,
	setTableObjectPrice
} from "../services/apiService.js"
import {
	validateTitleLength,
	validateDescriptionLength,
	validateCategoriesLength,
	validateLanguage,
	validatePrice,
	validatePrintPrice,
	validateIsbn,
	validateStatus
} from "../services/validationService.js"

export async function retrieveStoreBook(
	parent: any,
	args: { uuid: string },
	context: ResolverContext
): Promise<StoreBook> {
	const uuid = args.uuid
	if (uuid == null) return null

	let storeBook = (await context.prisma.storeBook.findFirst({
		where: { uuid }
	})) as StoreBook

	await loadStoreBookData(
		context.prisma,
		storeBook,
		context.user == null && BigInt(context.user.id) != storeBook.userId
	)

	return storeBook
}

export async function listStoreBooks(
	parent: any,
	args: {
		categories?: string[]
		inReview?: boolean
		random?: boolean
		query?: string
		languages?: string[]
		limit?: number
		offset?: number
	},
	context: ResolverContext
): Promise<List<StoreBook>> {
	let take = args.limit || 10
	if (take <= 0) take = 10

	let skip = args.offset || 0
	if (skip < 0) skip = 0

	let inReview = args.inReview || false
	let random = args.random || false
	let query = args.query?.toLowerCase() || ""

	if (args.categories != null) {
		let storeBookIds: bigint[] = []
		let storeBooks: StoreBook[] = []

		for (let key of args.categories) {
			// Find the category table object
			let category = await context.prisma.category.findFirst({
				where: { key },
				include: { releases: true }
			})

			if (category == null) continue

			for (let storeBookRelease of category.releases) {
				if (
					!storeBookIds.includes(storeBookRelease.storeBookId) &&
					storeBookRelease.status == "published"
				) {
					storeBookIds.push(storeBookRelease.storeBookId)
				}
			}
		}

		for (let id of storeBookIds) {
			let storeBook = (await context.prisma.storeBook.findFirst({
				where: { id }
			})) as StoreBook

			if (storeBook != null) {
				await loadStoreBookData(context.prisma, storeBook)
				storeBooks.push(storeBook)
			}
		}

		return {
			total: storeBooks.length,
			items: storeBooks.slice(skip, skip + take)
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
		let where = { userId: user.id, status: "review" }

		let total = await context.prisma.storeBook.count({ where })

		let items = (await context.prisma.storeBook.findMany({
			where,
			take,
			skip
		})) as StoreBook[]

		for (let storeBook of items) {
			await loadStoreBookData(context.prisma, storeBook, false)
		}

		return {
			total,
			items
		}
	} else if (random) {
		let total = await context.prisma.storeBook.count()
		if (take > total) take = total

		let indices = []
		let items = []

		while (indices.length < take) {
			let i = randomNumber(0, total - 1)

			if (!indices.includes(i)) {
				indices.push(i)
			}
		}

		for (let i of indices) {
			let storeBook = (await context.prisma.storeBook.findFirst({
				skip: i
			})) as StoreBook

			await loadStoreBookData(context.prisma, storeBook)

			items.push(storeBook)
		}

		return {
			total,
			items
		}
	} else if (args.query.length > 0) {
		let where = {
			AND: [
				{ status: { equals: "published" } },
				{
					OR: [
						{
							releases: {
								some: {
									OR: [
										{
											title: {
												contains: query,
												mode: Prisma.QueryMode.insensitive
											}
										},
										{
											description: {
												contains: query,
												mode: Prisma.QueryMode.insensitive
											}
										},
										{
											isbn: {
												contains: query,
												mode: Prisma.QueryMode.insensitive
											}
										}
									]
								}
							}
						},
						{
							collection: {
								author: {
									OR: [
										{
											firstName: {
												in: query.split(" "),
												mode: Prisma.QueryMode.insensitive
											}
										},
										{
											lastName: {
												in: query.split(" "),
												mode: Prisma.QueryMode.insensitive
											}
										}
									]
								}
							}
						}
					]
				}
			]
		}

		let total = await context.prisma.storeBook.count({ where })

		let items = (await context.prisma.storeBook.findMany({
			where,
			take,
			skip
		})) as StoreBook[]

		for (let storeBook of items) {
			await loadStoreBookData(context.prisma, storeBook)
		}

		return {
			total,
			items
		}
	} else {
		let where = { status: { equals: "published" } }
		let total = await context.prisma.storeBook.count({ where })

		let items = (await context.prisma.storeBook.findMany({
			where,
			orderBy: { id: "desc" },
			take,
			skip
		})) as StoreBook[]

		for (let storeBook of items) {
			await loadStoreBookData(context.prisma, storeBook)
		}

		return {
			total,
			items
		}
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
		printPrice?: number
		isbn?: string
		categories?: string[]
	},
	context: ResolverContext
): Promise<StoreBook> {
	const accessToken = context.accessToken
	const user = context.user

	// Check if the user is logged in
	if (user == null) {
		throwApiError(apiErrors.notAuthenticated)
	}

	let isAdmin = admins.includes(user.id)
	let author: Author = null

	if (isAdmin) {
		if (args.author == null) {
			throwValidationError(validationErrors.authorRequired)
		}

		// Get the author
		author = await context.prisma.author.findFirst({
			where: { uuid: args.author }
		})

		if (author == null) {
			throwApiError(apiErrors.authorDoesNotExist)
		}
	} else {
		// Check if the user is an author
		author = await context.prisma.author.findFirst({
			where: { userId: user.id }
		})

		if (author == null) {
			throwApiError(apiErrors.actionNotAllowed)
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

	if (args.printPrice != null) {
		errors.push(validatePrintPrice(args.printPrice))
	}

	if (args.isbn != null) {
		errors.push(validateIsbn(args.isbn))
	}

	if (args.categories != null) {
		errors.push(validateCategoriesLength(args.categories))
	}

	throwValidationError(...errors)

	let storeBookCollection: StoreBookCollection = null

	if (args.collection == null) {
		// Create the store book collection
		storeBookCollection = await context.prisma.storeBookCollection.create({
			data: {
				uuid: crypto.randomUUID(),
				userId: user.id,
				author: {
					connect: {
						id: author.id
					}
				}
			}
		})

		// Create the store book collection name
		await context.prisma.storeBookCollectionName.create({
			data: {
				uuid: crypto.randomUUID(),
				userId: user.id,
				collection: {
					connect: {
						id: storeBookCollection.id
					}
				},
				name: args.title,
				language: args.language
			}
		})
	} else {
		// Get the collection
		storeBookCollection = await context.prisma.storeBookCollection.findFirst({
			where: { uuid: args.collection }
		})

		if (storeBookCollection == null) {
			throwApiError(apiErrors.storeBookCollectionDoesNotExist)
		}

		// Check if the collection already has a name for the given language
		let nameCount = await context.prisma.storeBookCollectionName.count({
			where: {
				collectionId: storeBookCollection.id,
				language: args.language
			}
		})

		if (nameCount == 0) {
			// Create the store book collection name
			await context.prisma.storeBookCollectionName.create({
				data: {
					uuid: crypto.randomUUID(),
					userId: user.id,
					collection: {
						connect: {
							id: storeBookCollection.id
						}
					},
					name: args.title,
					language: args.language
				}
			})
		}
	}

	// Create the store book
	let storeBook = await context.prisma.storeBook.create({
		data: {
			uuid: crypto.randomUUID(),
			userId: user.id,
			collection: {
				connect: {
					id: storeBookCollection.id
				}
			},
			language: args.language,
			status: "unpublished"
		}
	})

	// Create the store book release
	let storeBookReleaseProperties = {
		uuid: crypto.randomUUID(),
		userId: user.id,
		storeBook: {
			connect: {
				id: storeBook.id
			}
		},
		title: args.title,
		price: 0,
		printPrice: 0,
		status: "unpublished"
	}

	if (args.description != null) {
		storeBookReleaseProperties["description"] = args.description
	}

	if (args.price != null) {
		storeBookReleaseProperties.price = args.price
	}

	if (args.printPrice != null) {
		storeBookReleaseProperties.printPrice = args.printPrice
	}

	if (args.isbn != null) {
		storeBookReleaseProperties["isbn"] = args.isbn
	}

	if (args.categories != null) {
		storeBookReleaseProperties["categories"] = { connect: [] }

		// Get the category ids
		let categoryIds = await getCategoryIds(context.prisma, args.categories)

		for (let id of categoryIds) {
			storeBookReleaseProperties["categories"]["connect"].push({ id })
		}
	}

	await context.prisma.storeBookRelease.create({
		data: storeBookReleaseProperties
	})

	// Create the store book table object
	let createStoreBookResponse = await TableObjectsController.CreateTableObject(
		{
			accessToken,
			uuid: storeBook.uuid,
			tableId: storeBookTableId
		}
	)

	if (!isSuccessStatusCode(createStoreBookResponse.status)) {
		throwApiError(apiErrors.unexpectedError)
	}

	// Set the price of the table object
	let storeBookPrice = await setTableObjectPrice({
		accessToken,
		tableObjectUuid: storeBook.uuid,
		price: args.price || 0,
		currency: "EUR",
		type: "PURCHASE"
	})

	if (storeBookPrice == null) {
		throwApiError(apiErrors.unexpectedError)
	}

	if (args.printPrice != null) {
		// Set the price of the store book release
		let storeBookReleasePrice = await setTableObjectPrice({
			accessToken,
			tableObjectUuid: storeBook.uuid,
			price: args.printPrice,
			currency: "EUR",
			type: "ORDER"
		})

		if (storeBookReleasePrice == null) {
			throwApiError(apiErrors.unexpectedError)
		}
	}

	return {
		...storeBook,
		title: args.title,
		description: args.description,
		price: args.price || 0,
		printPrice: args.printPrice || 0,
		isbn: args.isbn
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
		printPrice?: number
		isbn?: string
		status?: string
		categories?: string[]
	},
	context: ResolverContext
): Promise<StoreBook> {
	const accessToken = context.accessToken
	const user = context.user

	// Check if the user is logged in
	if (user == null) {
		throwApiError(apiErrors.notAuthenticated)
	}

	const isAdmin = admins.includes(user.id)

	// Get the store book
	let storeBook = (await context.prisma.storeBook.findFirst({
		where: { uuid: args.uuid }
	})) as StoreBook

	// Check if the store book belongs to the user
	if (!isAdmin && storeBook.userId != BigInt(user.id)) {
		throwApiError(apiErrors.actionNotAllowed)
	}

	// Get the latest release
	let storeBookRelease = await getLastReleaseOfStoreBook(
		context.prisma,
		storeBook.id,
		false
	)

	if (storeBookRelease == null) {
		throwApiError(apiErrors.storeBookReleaseDoesNotExist)
	}

	// Validate the args
	if (
		args.title == null &&
		args.description == null &&
		args.language == null &&
		args.price == null &&
		args.printPrice == null &&
		args.isbn == null &&
		args.status == null &&
		args.categories == null
	) {
		await loadStoreBookData(context.prisma, storeBook, false)
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

	if (args.printPrice != null) {
		errors.push(validatePrintPrice(args.printPrice))
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
		(storeBook.status == "published" || storeBook.status == "hidden") &&
		args.language != null
	) {
		throwApiError(apiErrors.cannotUpdateStoreBookLanguage)
	}

	// Check if the store book release is already published
	if (storeBookRelease.status == "published") {
		// Create a new release
		storeBookRelease = await createNewStoreBookRelease(
			context.prisma,
			context.accessToken,
			storeBook,
			storeBookRelease,
			user.id
		)
	}

	if (args.language != null) {
		// Update the store book with releases and new language
		await context.prisma.storeBook.update({
			where: { id: storeBook.id },
			data: {
				language: args.language
			}
		})
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

	if (args.printPrice != null) {
		newReleaseProperties["printPrice"] = args.printPrice
	}

	if (args.isbn != null) {
		newReleaseProperties["isbn"] = args.isbn.length == 0 ? null : args.isbn
	}

	// Check if the new status is compatible with the old status
	if (args.status != null) {
		let oldStatus = storeBookRelease.status
		let newStoreBookStatus = null

		if (isAdmin) {
			if (
				((oldStatus == null ||
					oldStatus == "unpublished" ||
					oldStatus == "review") &&
					args.status == "hidden") ||
				args.status == "published"
			) {
				checkPropertiesForPublishing(storeBookRelease)
			}

			// Update the status
			newStoreBookStatus = args.status

			if (args.status == "published") {
				// Set the status of the release to "published"
				newReleaseProperties["status"] = "published"
			}
		} else {
			if (
				(storeBook.status == null || storeBook.status == "unpublished") &&
				args.status == "review"
			) {
				// Check if the store book can be published
				checkPropertiesForPublishing(storeBookRelease)

				// Change the status of the store book to "review"
				newStoreBookStatus = "review"
			} else if (
				storeBook.status == "review" &&
				args.status == "unpublished"
			) {
				// Change the status of the book to "unpublished"
				newStoreBookStatus = "unpublished"
			} else if (
				storeBook.status == "hidden" &&
				args.status == "published"
			) {
				// Change the status of the book to "published"
				newStoreBookStatus = "published"
			} else if (
				storeBook.status == "published" &&
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
			await context.prisma.storeBook.update({
				where: { id: storeBook.id },
				data: {
					status: newStoreBookStatus
				}
			})
		}
	}

	if (args.categories != null) {
		newReleaseProperties["categories"] = { connect: [] }

		// Get the category ids
		let categoryIds = await getCategoryIds(context.prisma, args.categories)

		for (let id of categoryIds) {
			newReleaseProperties["categories"]["connect"].push({ id })
		}
	}

	// Update the release
	await context.prisma.storeBookRelease.update({
		where: { id: storeBookRelease.id },
		data: newReleaseProperties
	})

	if (args.price != null) {
		// Set the store book price
		let updateStoreBookPrice = await setTableObjectPrice({
			accessToken,
			tableObjectUuid: storeBook.uuid,
			price: args.price,
			currency: "EUR",
			type: "PURCHASE"
		})

		if (updateStoreBookPrice == null) {
			throwApiError(apiErrors.unexpectedError)
		}
	}

	if (args.printPrice != null) {
		// Set the store book release print price
		let updateStoreBookReleasePrice = await setTableObjectPrice({
			accessToken,
			tableObjectUuid: storeBookRelease.uuid,
			price: args.printPrice,
			currency: "EUR",
			type: "ORDER"
		})

		if (updateStoreBookReleasePrice == null) {
			throwApiError(apiErrors.unexpectedError)
		}
	}

	await loadStoreBookData(context.prisma, storeBook, false)
	return storeBook
}

export async function collection(
	storeBook: StoreBook,
	args: any,
	context: ResolverContext
): Promise<StoreBookCollection> {
	return await context.prisma.storeBookCollection.findFirst({
		where: { id: storeBook.collectionId }
	})
}

export async function cover(
	storeBook: StoreBook,
	args: any,
	context: ResolverContext
): Promise<StoreBookCover> {
	let release = await getLastReleaseOfStoreBook(
		context.prisma,
		storeBook.id,
		context.user == null && BigInt(context.user.id) != storeBook.userId
	)
	if (release.coverId == null) return null

	let cover = await context.prisma.storeBookCover.findFirst({
		where: { id: release.coverId }
	})

	return {
		...cover,
		url: getTableObjectFileUrl(cover.uuid)
	}
}

export async function file(
	storeBook: StoreBook,
	args: any,
	context: ResolverContext
): Promise<StoreBookFile> {
	let release = await getLastReleaseOfStoreBook(
		context.prisma,
		storeBook.id,
		context.user == null && BigInt(context.user.id) != storeBook.userId
	)
	if (release.fileId == null) return null

	return await context.prisma.storeBookFile.findFirst({
		where: { id: release.fileId }
	})
}

export async function printCover(
	storeBook: StoreBook,
	args: any,
	context: ResolverContext
): Promise<StoreBookPrintCover> {
	let release = await getLastReleaseOfStoreBook(
		context.prisma,
		storeBook.id,
		context.user == null && BigInt(context.user.id) != storeBook.userId
	)
	if (release.printCoverId == null) return null

	return await context.prisma.storeBookPrintCover.findFirst({
		where: { id: release.printCoverId }
	})
}

export async function printFile(
	storeBook: StoreBook,
	args: any,
	context: ResolverContext
): Promise<StoreBookPrintFile> {
	let release = await getLastReleaseOfStoreBook(
		context.prisma,
		storeBook.id,
		context.user == null && BigInt(context.user.id) != storeBook.userId
	)
	if (release.printFileId == null) return null

	return await context.prisma.storeBookPrintFile.findFirst({
		where: { id: release.printFileId }
	})
}

export async function categories(
	storeBook: StoreBook,
	args: { limit?: number; offset?: number },
	context: ResolverContext
): Promise<List<Category>> {
	let take = args.limit || 10
	if (take <= 0) take = 10

	let skip = args.offset || 0
	if (skip < 0) skip = 0

	let release = await getLastReleaseOfStoreBook(context.prisma, storeBook.id)
	let where = { releases: { some: { id: release.id } } }

	let [total, items] = await context.prisma.$transaction([
		context.prisma.category.count({ where }),
		context.prisma.category.findMany({ where })
	])

	return {
		total,
		items
	}
}

export async function series(
	storeBook: StoreBook,
	args: { limit?: number; offset?: number },
	context: ResolverContext
): Promise<List<StoreBookSeries>> {
	let take = args.limit || 10
	if (take <= 0) take = 10

	let skip = args.offset || 0
	if (skip < 0) skip = 0

	let where = { storeBooks: { some: { id: storeBook.id } } }

	let [total, items] = await context.prisma.$transaction([
		context.prisma.storeBookSeries.count(),
		context.prisma.storeBookSeries.findMany({ where })
	])

	return {
		total,
		items
	}
}

export async function releases(
	storeBook: StoreBook,
	args: { limit?: number; offset?: number },
	context: ResolverContext
): Promise<List<StoreBookRelease>> {
	let take = args.limit || 10
	if (take <= 0) take = 10

	let skip = args.offset || 0
	if (skip < 0) skip = 0

	let where = { storeBookId: storeBook.id }

	let [total, items] = await context.prisma.$transaction([
		context.prisma.storeBookRelease.count({ where }),
		context.prisma.storeBookRelease.findMany({
			where,
			orderBy: { publishedAt: "desc" }
		})
	])

	return {
		total,
		items
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

	return purchases.length > 0
}

//#region Helper functions
function checkPropertiesForPublishing(storeBookRelease: StoreBookRelease) {
	let errors = []

	if (storeBookRelease.description == null) {
		errors.push(validationErrors.cannotPublishStoreBookWithoutDescription)
	}

	if (storeBookRelease.coverId == null) {
		errors.push(validationErrors.cannotPublishStoreBookWithoutCover)
	}

	if (storeBookRelease.fileId == null) {
		errors.push(validationErrors.cannotPublishStoreBookWithoutFile)
	}

	if (
		storeBookRelease.printCoverId == null ||
		storeBookRelease.printFileId == null
	) {
		errors.push(
			validationErrors.cannotPublishStoreBookWithIncompletePrintFiles
		)
	} else if (storeBookRelease.printPrice == 0) {
		errors.push(validationErrors.cannotPublishStoreBookWithFreePrintBook)
	}

	throwValidationError(...errors)
}

async function getCategoryIds(
	prisma: PrismaClient,
	categoryKeys: string[]
): Promise<bigint[]> {
	let ids: bigint[] = []

	for (let key of categoryKeys) {
		let category = await prisma.category.findFirst({
			where: { key }
		})

		if (category != null) {
			ids.push(category.id)
		}
	}

	return ids
}
//#endregion
