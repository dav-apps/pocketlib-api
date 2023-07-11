import {
	ResolverContext,
	TableObject,
	Publisher,
	Author,
	StoreBookCollection,
	StoreBook,
	StoreBookRelease,
	Category,
	CategoryName
} from "./types.js"
import {
	convertTableObjectToPublisher,
	convertTableObjectToPublisherLogo,
	convertTableObjectToAuthor,
	convertTableObjectToAuthorProfileImage,
	convertTableObjectToStoreBookCollection,
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
		listPublishers: async () => {
			let tableObjects = await listTableObjects({
				tableName: "Publisher"
			})

			let result: Publisher[] = []

			for (let obj of tableObjects) {
				result.push(convertTableObjectToPublisher(obj))
			}

			return result
		},
		listAuthors: async (
			parent: any,
			args: { limit?: number; latest?: boolean }
		) => {
			let tableObjects: TableObject[] = []
			let limit = args.limit || 10

			if (args.latest) {
				tableObjects = await listTableObjects({
					limit,
					collectionName: "latest_authors"
				})
			} else {
				tableObjects = await listTableObjects({
					limit,
					tableName: "Author"
				})
			}

			let result: Author[] = []

			for (let obj of tableObjects) {
				result.push(convertTableObjectToAuthor(obj))
			}

			return result
		},
		retrieveStoreBook: async (parent: any, args: { uuid: string }) => {
			const uuid = args.uuid

			if (uuid == null) {
				return null
			}

			let tableObject = await getTableObject(uuid)
			if (tableObject == null) return null

			const storeBookTableObject = convertTableObjectToStoreBook(tableObject)

			// Get the latest release of the StoreBook
			const releasesString = storeBookTableObject.releases as string

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
		listCategories: async (parent: any, args: { language?: string }) => {
			let tableObjects = await listTableObjects({
				tableName: "Category"
			})

			let result: Category[] = []

			for (let obj of tableObjects) {
				result.push(convertTableObjectToCategory(obj))
			}

			return result
		}
	},
	Publisher: {
		logo: async (publisher: Publisher) => {
			const uuid = publisher.logo as string
			if (uuid == null) return null

			let tableObject = await getTableObject(uuid)
			if (tableObject == null) return null

			return convertTableObjectToPublisherLogo(tableObject)
		},
		authors: async (publisher: Publisher) => {
			if (publisher.authors == null) {
				return []
			}

			let authorUuids = (publisher.authors as string).split(",")
			let authors: Author[] = []

			for (let uuid of authorUuids) {
				let author = await getTableObject(uuid)
				if (author == null) continue

				authors.push(convertTableObjectToAuthor(author))
			}

			return authors
		}
	},
	Author: {
		profileImage: async (author: Author) => {
			const uuid = author.profileImage as string
			if (uuid == null) return null

			let tableObject = await getTableObject(uuid)
			if (tableObject == null) return null

			return convertTableObjectToAuthorProfileImage(tableObject)
		}
	},
	StoreBookCollection: {
		author: async (storeBookCollection: StoreBookCollection) => {
			const uuid = storeBookCollection.author as string
			if (uuid == null) return null

			let tableObject = await getTableObject(uuid)
			if (tableObject == null) return null

			return convertTableObjectToAuthor(tableObject)
		}
	},
	StoreBook: {
		collection: async (storeBook: StoreBook) => {
			const uuid = storeBook.collection as string
			if (uuid == null) return null

			let tableObject = await getTableObject(uuid)
			if (tableObject == null) return null

			return convertTableObjectToStoreBookCollection(tableObject)
		},
		cover: async (storeBook: StoreBook) => {
			const uuid = storeBook.cover as string
			if (uuid == null) return null

			let tableObject = await getTableObject(uuid)
			if (tableObject == null) return null

			return convertTableObjectToStoreBookCover(tableObject)
		},
		file: async (storeBook: StoreBook) => {
			const uuid = storeBook.file as string
			if (uuid == null) return null

			let tableObject = await getTableObject(uuid)
			if (tableObject == null) return null

			return convertTableObjectToStoreBookFile(tableObject)
		},
		categories: async (storeBook: StoreBook) => {
			let categoryUuidsString = storeBook.categories as string
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
		inLibrary: async (
			storeBook: StoreBook,
			args: any,
			context: ResolverContext
		) => {
			if (context.user == null) {
				return null
			}

			let tableObjects = await listTableObjects({
				caching: false,
				userId: context.user.id,
				tableName: "Book",
				propertyName: "store_book",
				propertyValue: storeBook.uuid,
				exact: true
			})

			return tableObjects.length > 0
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
			const uuid = storeBookRelease.cover as string
			if (uuid == null) return null

			let tableObject = await getTableObject(uuid)
			if (tableObject == null) return null

			return convertTableObjectToStoreBookCover(tableObject)
		},
		file: async (storeBookRelease: StoreBookRelease) => {
			const uuid = storeBookRelease.file as string
			if (uuid == null) return null

			let tableObject = await getTableObject(uuid)
			if (tableObject == null) return null

			return convertTableObjectToStoreBookFile(tableObject)
		}
	},
	Category: {
		name: async (category: Category, args: any, context: any, info: any) => {
			const namesString = category.names as string
			if (namesString == null) return null

			// Get all names
			let nameUuids = namesString.split(",")
			let names: CategoryName[] = []

			for (let uuid of nameUuids) {
				let nameObj = await getTableObject(uuid)
				if (nameObj == null) continue

				names.push(convertTableObjectToCategoryName(nameObj))
			}

			// Get the optimal name for the given language
			let language = info?.variableValues?.language || "en"
			let name = names.find(n => n.language == language)

			if (name != null) {
				return name
			}

			name = names.find(n => n.language == "en")

			if (name != null) {
				return name
			}

			return names[0]
		}
	}
}
