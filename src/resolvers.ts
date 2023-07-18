import {
	ResolverContext,
	List,
	TableObject,
	Publisher,
	PublisherLogo,
	Author,
	AuthorBio,
	AuthorProfileImage,
	StoreBookCollection,
	StoreBookCollectionName,
	StoreBookSeries,
	StoreBook,
	StoreBookCover,
	StoreBookFile,
	StoreBookRelease,
	Category,
	CategoryName
} from "./types.js"
import {
	loadStoreBookData,
	convertTableObjectToPublisher,
	convertTableObjectToPublisherLogo,
	convertTableObjectToAuthor,
	convertTableObjectToAuthorBio,
	convertTableObjectToAuthorProfileImage,
	convertTableObjectToStoreBookCollection,
	convertTableObjectToStoreBookCollectionName,
	convertTableObjectToStoreBookSeries,
	convertTableObjectToStoreBook,
	convertTableObjectToStoreBookRelease,
	convertTableObjectToStoreBookCover,
	convertTableObjectToStoreBookFile,
	convertTableObjectToCategory,
	convertTableObjectToCategoryName
} from "./utils.js"
import {
	getTableObject,
	listTableObjects,
	listPurchasesOfTableObject
} from "./services/apiService.js"

export const resolvers = {
	Query: {
		retrievePublisher: async (
			parent: any,
			args: { uuid: string }
		): Promise<Publisher> => {
			const uuid = args.uuid
			if (uuid == null) return null

			let tableObject = await getTableObject(uuid)
			if (tableObject == null) return null

			return convertTableObjectToPublisher(tableObject)
		},
		listPublishers: async (
			parent: any,
			args: { limit?: number; offset?: number }
		): Promise<List<Publisher>> => {
			let limit = args.limit || 10
			if (limit <= 0) limit = 10

			let offset = args.offset || 0
			if (offset < 0) offset = 0

			let response = await listTableObjects({
				tableName: "Publisher",
				limit,
				offset
			})

			let result: Publisher[] = []

			for (let obj of response.items) {
				result.push(convertTableObjectToPublisher(obj))
			}

			return {
				total: response.total,
				items: result
			}
		},
		retrieveAuthor: async (
			parent: any,
			args: { uuid: string }
		): Promise<Author> => {
			const uuid = args.uuid
			if (uuid == null) return null

			let tableObject = await getTableObject(uuid)
			if (tableObject == null) return null

			return convertTableObjectToAuthor(tableObject)
		},
		listAuthors: async (
			parent: any,
			args: { latest?: boolean; limit?: number; offset?: number }
		): Promise<List<Author>> => {
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
		},
		retrieveStoreBookCollection: async (
			parent: any,
			args: { uuid: string; languages?: string[] }
		): Promise<StoreBookCollection> => {
			const uuid = args.uuid
			if (uuid == null) return null

			let tableObject = await getTableObject(uuid)
			if (tableObject == null) return null

			return convertTableObjectToStoreBookCollection(tableObject)
		},
		retrieveStoreBookSeries: async (
			parent: any,
			args: { uuid: string }
		): Promise<StoreBookSeries> => {
			const uuid = args.uuid
			if (uuid == null) return null

			let tableObject = await getTableObject(uuid)
			if (tableObject == null) return null

			return convertTableObjectToStoreBookSeries(tableObject)
		},
		retrieveStoreBook: async (
			parent: any,
			args: { uuid: string }
		): Promise<StoreBook> => {
			const uuid = args.uuid
			if (uuid == null) return null

			let tableObject = await getTableObject(uuid)
			if (tableObject == null) return null

			const storeBook = convertTableObjectToStoreBook(tableObject)
			await loadStoreBookData(storeBook)
			return storeBook
		},
		listStoreBooks: async (
			parent: any,
			args: {
				latest?: boolean
				categories?: string[]
				languages?: string[]
				limit?: number
				offset?: number
			}
		): Promise<List<StoreBook>> => {
			let total = 0
			let serverPagination = false
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
					collectionName: "latest_books"
				})

				total = response.total
				tableObjects = response.items
				serverPagination = true
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
						let storeBookUuid = storeBookRelease.properties
							.store_book as string
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
			}

			let result: StoreBook[] = []

			for (let obj of tableObjects) {
				let storeBook = convertTableObjectToStoreBook(obj)

				if (languages.includes(storeBook.language)) {
					await loadStoreBookData(storeBook)
					result.push(storeBook)
				}
			}

			if (serverPagination) {
				return {
					total,
					items: result
				}
			} else {
				return {
					total: result.length,
					items: result.slice(offset, limit + offset)
				}
			}
		},
		listCategories: async (
			parent: any,
			args: { limit?: number; offset?: number }
		): Promise<List<Category>> => {
			let limit = args.limit || 10
			if (limit <= 0) limit = 10

			let offset = args.offset || 0
			if (offset < 0) offset = 0

			let response = await listTableObjects({
				tableName: "Category",
				limit,
				offset
			})

			let result: Category[] = []

			for (let obj of response.items) {
				result.push(convertTableObjectToCategory(obj))
			}

			return {
				total: response.total,
				items: result
			}
		}
	},
	Publisher: {
		logo: async (publisher: Publisher): Promise<PublisherLogo> => {
			const uuid = publisher.logo
			if (uuid == null) return null

			let tableObject = await getTableObject(uuid)
			if (tableObject == null) return null

			return convertTableObjectToPublisherLogo(tableObject)
		},
		authors: async (
			publisher: Publisher,
			args: { limit?: number; offset?: number }
		): Promise<List<Author>> => {
			if (publisher.authors == null) {
				return {
					total: 0,
					items: []
				}
			}

			let limit = args.limit || 10
			if (limit <= 0) limit = 10

			let offset = args.offset || 0
			if (offset < 0) offset = 0

			let authorUuids = publisher.authors.split(",")
			let authors: Author[] = []

			for (let uuid of authorUuids) {
				let author = await getTableObject(uuid)
				if (author == null) continue

				authors.push(convertTableObjectToAuthor(author))
			}

			return {
				total: authors.length,
				items: authors.slice(offset, limit + offset)
			}
		}
	},
	Author: {
		publisher: async (author: Author): Promise<Publisher> => {
			const uuid = author.publisher
			if (uuid == null) return null

			let tableObject = await getTableObject(uuid)
			if (tableObject == null) return null

			return convertTableObjectToPublisher(tableObject)
		},
		bio: async (
			author: Author,
			args: any,
			context: any,
			info: any
		): Promise<AuthorBio> => {
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
		},
		profileImage: async (author: Author): Promise<AuthorProfileImage> => {
			const uuid = author.profileImage
			if (uuid == null) return null

			let tableObject = await getTableObject(uuid)
			if (tableObject == null) return null

			return convertTableObjectToAuthorProfileImage(tableObject)
		},
		bios: async (
			author: Author,
			args: { limit?: number; offset?: number }
		): Promise<List<AuthorBio>> => {
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
		},
		collections: async (
			author: Author,
			args: { limit?: number; offset?: number }
		): Promise<List<StoreBookCollection>> => {
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

				collections.push(
					convertTableObjectToStoreBookCollection(tableObject)
				)
			}

			return {
				total: collections.length,
				items: collections.slice(offset, limit + offset)
			}
		},
		series: async (
			author: Author,
			args: { limit?: number; offset?: number }
		): Promise<List<StoreBookSeries>> => {
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
	},
	StoreBookCollection: {
		author: async (
			storeBookCollection: StoreBookCollection
		): Promise<Author> => {
			const uuid = storeBookCollection.author
			if (uuid == null) return null

			let tableObject = await getTableObject(uuid)
			if (tableObject == null) return null

			return convertTableObjectToAuthor(tableObject)
		},
		name: async (
			storeBookCollection: StoreBookCollection,
			args: any,
			context: any,
			info: any
		): Promise<StoreBookCollectionName> => {
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
		},
		names: async (
			storeBookCollection: StoreBookCollection,
			args: { limit?: number; offset?: number }
		): Promise<List<StoreBookCollectionName>> => {
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
		},
		storeBooks: async (
			storeBookCollection: StoreBookCollection,
			args: { limit?: number; offset?: number }
		): Promise<List<StoreBook>> => {
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
	},
	StoreBookSeries: {
		storeBooks: async (
			storeBookSeries: StoreBookSeries,
			args: { limit?: number; offset?: number }
		): Promise<List<StoreBook>> => {
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
	},
	StoreBook: {
		collection: async (
			storeBook: StoreBook
		): Promise<StoreBookCollection> => {
			const uuid = storeBook.collection
			if (uuid == null) return null

			let tableObject = await getTableObject(uuid)
			if (tableObject == null) return null

			return convertTableObjectToStoreBookCollection(tableObject)
		},
		cover: async (storeBook: StoreBook): Promise<StoreBookCover> => {
			const uuid = storeBook.cover
			if (uuid == null) return null

			let tableObject = await getTableObject(uuid)
			if (tableObject == null) return null

			return convertTableObjectToStoreBookCover(tableObject)
		},
		file: async (storeBook: StoreBook): Promise<StoreBookFile> => {
			const uuid = storeBook.file
			if (uuid == null) return null

			let tableObject = await getTableObject(uuid)
			if (tableObject == null) return null

			return convertTableObjectToStoreBookFile(tableObject)
		},
		categories: async (
			storeBook: StoreBook,
			args: { limit?: number; offset?: number }
		): Promise<List<Category>> => {
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
		},
		series: async (
			storeBook: StoreBook,
			args: { limit?: number; offset?: number }
		): Promise<List<StoreBookSeries>> => {
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
		},
		releases: async (
			storeBook: StoreBook,
			args: { limit?: number; offset?: number }
		): Promise<List<StoreBookRelease>> => {
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
		},
		inLibrary: async (
			storeBook: StoreBook,
			args: any,
			context: ResolverContext
		): Promise<boolean> => {
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
		},
		purchased: async (
			storeBook: StoreBook,
			args: any,
			context: ResolverContext
		): Promise<boolean> => {
			if (context.user == null) {
				return null
			}

			let purchases = await listPurchasesOfTableObject({
				uuid: storeBook.uuid,
				userId: context.user.id
			})

			return purchases.length >= 0
		}
	},
	StoreBookRelease: {
		cover: async (
			storeBookRelease: StoreBookRelease
		): Promise<StoreBookCover> => {
			const uuid = storeBookRelease.cover
			if (uuid == null) return null

			let tableObject = await getTableObject(uuid)
			if (tableObject == null) return null

			return convertTableObjectToStoreBookCover(tableObject)
		},
		file: async (
			storeBookRelease: StoreBookRelease
		): Promise<StoreBookFile> => {
			const uuid = storeBookRelease.file
			if (uuid == null) return null

			let tableObject = await getTableObject(uuid)
			if (tableObject == null) return null

			return convertTableObjectToStoreBookFile(tableObject)
		},
		categories: async (
			storeBookRelease: StoreBookRelease,
			args: { limit?: number; offset?: number }
		): Promise<List<Category>> => {
			let categoryUuidsString = storeBookRelease.categories

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
	},
	Category: {
		name: async (
			category: Category,
			args: any,
			context: any,
			info: any
		): Promise<CategoryName> => {
			const namesString = category.names
			if (namesString == null) return null

			// Get all names
			let nameUuids = namesString.split(",")
			let names: CategoryName[] = []

			for (let uuid of nameUuids) {
				let nameObj = await getTableObject(uuid)
				if (nameObj == null) continue

				names.push(convertTableObjectToCategoryName(nameObj))
			}

			// Find the optimal name for the given languages
			let languages = info?.variableValues?.languages || ["en"]
			let selectedNames: CategoryName[] = []

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
		},
		names: async (
			category: Category,
			args: { limit?: number; offset?: number }
		): Promise<List<CategoryName>> => {
			let categoryNameUuidsString = category.names

			if (categoryNameUuidsString == null) {
				return {
					total: 0,
					items: []
				}
			}

			let limit = args.limit || 10
			if (limit <= 0) limit = 10

			let offset = args.offset || 0
			if (offset < 0) offset = 0

			let categoryNameUuids = categoryNameUuidsString.split(",")
			let categoryNames: CategoryName[] = []

			for (let uuid of categoryNameUuids) {
				let tableObject = await getTableObject(uuid)
				if (tableObject == null) continue

				categoryNames.push(convertTableObjectToCategoryName(tableObject))
			}

			return {
				total: categoryNames.length,
				items: categoryNames.slice(offset, limit + offset)
			}
		}
	}
}
