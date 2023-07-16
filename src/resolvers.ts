import {
	ResolverContext,
	List,
	TableObject,
	Publisher,
	Author,
	AuthorBio,
	StoreBookCollection,
	StoreBookCollectionName,
	StoreBookSeries,
	StoreBook,
	StoreBookRelease,
	Category,
	CategoryName
} from "./types.js"
import {
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
		retrievePublisher: async (parent: any, args: { uuid: string }) => {
			const uuid = args.uuid
			if (uuid == null) return null

			let tableObject = await getTableObject(uuid)
			if (tableObject == null) return null

			return convertTableObjectToPublisher(tableObject)
		},
		listPublishers: async (): Promise<List<Publisher>> => {
			let response = await listTableObjects({
				tableName: "Publisher"
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
		retrieveAuthor: async (parent: any, args: { uuid: string }) => {
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
			let offset = args.offset || 0

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
				total: total,
				items: result
			}
		},
		retrieveStoreBook: async (parent: any, args: { uuid: string }) => {
			const uuid = args.uuid
			if (uuid == null) return null

			let tableObject = await getTableObject(uuid)
			if (tableObject == null) return null

			const storeBookTableObject = convertTableObjectToStoreBook(tableObject)

			// Get the latest release of the StoreBook
			const releasesString = storeBookTableObject.releases

			if (releasesString != null) {
				let releaseUuids = releasesString.split(",")

				for (let uuid of releaseUuids) {
					let releaseTableObject = await getTableObject(uuid)
					if (releaseTableObject == null) continue

					let release =
						convertTableObjectToStoreBookRelease(releaseTableObject)

					if (release.status == "published") {
						storeBookTableObject.title = release.title
						storeBookTableObject.description = release.description
						storeBookTableObject.price = release.price
						storeBookTableObject.isbn = release.isbn
						storeBookTableObject.cover = release.cover
						storeBookTableObject.file = release.file
						storeBookTableObject.categories = release.categories
					}
				}
			}

			return storeBookTableObject
		},
		listCategories: async (): Promise<List<Category>> => {
			let response = await listTableObjects({
				tableName: "Category"
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
		logo: async (publisher: Publisher) => {
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

			let allAuthorUuids = publisher.authors.split(",")
			let authorUuids = allAuthorUuids.slice(offset, limit + offset)
			let authors: Author[] = []

			for (let uuid of authorUuids) {
				let author = await getTableObject(uuid)
				if (author == null) continue

				authors.push(convertTableObjectToAuthor(author))
			}

			return {
				total: allAuthorUuids.length,
				items: authors
			}
		}
	},
	Author: {
		publisher: async (author: Author) => {
			const uuid = author.publisher
			if (uuid == null) return null

			let tableObject = await getTableObject(uuid)
			if (tableObject == null) return null

			return convertTableObjectToPublisher(tableObject)
		},
		bio: async (author: Author, args: any, context: any, info: any) => {
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
		profileImage: async (author: Author) => {
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

			let allBioUuids = bioUuidsString.split(",")
			let bioUuids = allBioUuids.slice(offset, limit + offset)
			let bios: AuthorBio[] = []

			for (let uuid of bioUuids) {
				let tableObject = await getTableObject(uuid)
				if (tableObject == null) continue

				bios.push(convertTableObjectToAuthorBio(tableObject))
			}

			return {
				total: allBioUuids.length,
				items: bios
			}
		},
		collections: async (author: Author) => {
			let collectionUuidsString = author.collections
			if (collectionUuidsString == null) return []

			let collectionUuids = collectionUuidsString.split(",")
			let collections: StoreBookCollection[] = []

			for (let uuid of collectionUuids) {
				let tableObject = await getTableObject(uuid)
				if (tableObject == null) continue

				collections.push(
					convertTableObjectToStoreBookCollection(tableObject)
				)
			}

			return collections
		},
		series: async (author: Author) => {
			let seriesUuidsString = author.series
			if (seriesUuidsString == null) return []

			let seriesUuids = seriesUuidsString.split(",")
			let series: StoreBookSeries[] = []

			for (let uuid of seriesUuids) {
				let tableObject = await getTableObject(uuid)
				if (tableObject == null) continue

				series.push(convertTableObjectToStoreBookSeries(tableObject))
			}

			return series
		}
	},
	StoreBookCollection: {
		author: async (storeBookCollection: StoreBookCollection) => {
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
		) => {
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
		names: async (storeBookCollection: StoreBookCollection) => {
			let nameUuidsString = storeBookCollection.names
			if (nameUuidsString == null) return []

			let nameUuids = nameUuidsString.split(",")
			let names: StoreBookCollectionName[] = []

			for (let uuid of nameUuids) {
				let tableObject = await getTableObject(uuid)
				if (tableObject == null) continue

				names.push(convertTableObjectToStoreBookCollectionName(tableObject))
			}

			return names
		}
	},
	StoreBook: {
		collection: async (storeBook: StoreBook) => {
			const uuid = storeBook.collection
			if (uuid == null) return null

			let tableObject = await getTableObject(uuid)
			if (tableObject == null) return null

			return convertTableObjectToStoreBookCollection(tableObject)
		},
		cover: async (storeBook: StoreBook) => {
			const uuid = storeBook.cover
			if (uuid == null) return null

			let tableObject = await getTableObject(uuid)
			if (tableObject == null) return null

			return convertTableObjectToStoreBookCover(tableObject)
		},
		file: async (storeBook: StoreBook) => {
			const uuid = storeBook.file
			if (uuid == null) return null

			let tableObject = await getTableObject(uuid)
			if (tableObject == null) return null

			return convertTableObjectToStoreBookFile(tableObject)
		},
		categories: async (storeBook: StoreBook) => {
			let categoryUuidsString = storeBook.categories
			if (categoryUuidsString == null) return []

			let categoryUuids = categoryUuidsString.split(",")
			let categories: Category[] = []

			for (let uuid of categoryUuids) {
				let tableObject = await getTableObject(uuid)
				if (tableObject == null) continue

				categories.push(convertTableObjectToCategory(tableObject))
			}

			return categories
		},
		series: async (storeBook: StoreBook) => {
			let response = await listTableObjects({
				tableName: "StoreBookSeries",
				propertyName: "store_books",
				propertyValue: storeBook.uuid
			})

			let series: StoreBookSeries[] = []

			for (let tableObject of response.items) {
				series.push(convertTableObjectToStoreBookSeries(tableObject))
			}

			return series
		},
		inLibrary: async (
			storeBook: StoreBook,
			args: any,
			context: ResolverContext
		) => {
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
		) => {
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
		cover: async (storeBookRelease: StoreBookRelease) => {
			const uuid = storeBookRelease.cover
			if (uuid == null) return null

			let tableObject = await getTableObject(uuid)
			if (tableObject == null) return null

			return convertTableObjectToStoreBookCover(tableObject)
		},
		file: async (storeBookRelease: StoreBookRelease) => {
			const uuid = storeBookRelease.file
			if (uuid == null) return null

			let tableObject = await getTableObject(uuid)
			if (tableObject == null) return null

			return convertTableObjectToStoreBookFile(tableObject)
		}
	},
	Category: {
		name: async (category: Category, args: any, context: any, info: any) => {
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
		}
	}
}
