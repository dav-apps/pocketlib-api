import {
	List,
	StoreBookCover,
	StoreBookFile,
	StoreBookRelease,
	Category,
	CategoryName
} from "./types.js"
import {
	convertTableObjectToStoreBookCover,
	convertTableObjectToStoreBookFile,
	convertTableObjectToCategory,
	convertTableObjectToCategoryName
} from "./utils.js"
import { getTableObject, listTableObjects } from "./services/apiService.js"
import * as publisherResolvers from "./resolvers/publisher.js"
import * as authorResolvers from "./resolvers/author.js"
import * as storeBookCollectionResolvers from "./resolvers/storeBookCollection.js"
import * as storeBookSeriesResolvers from "./resolvers/storeBookSeries.js"
import * as storeBookResolvers from "./resolvers/storeBook.js"

export const resolvers = {
	Query: {
		retrievePublisher: publisherResolvers.retrievePublisher,
		listPublishers: publisherResolvers.listPublishers,
		retrieveAuthor: authorResolvers.retrieveAuthor,
		listAuthors: authorResolvers.listAuthors,
		retrieveStoreBookCollection:
			storeBookCollectionResolvers.retrieveStoreBookCollection,
		retrieveStoreBookSeries: storeBookSeriesResolvers.retrieveStoreBookSeries,
		retrieveStoreBook: storeBookResolvers.retrieveStoreBook,
		listStoreBooks: storeBookResolvers.listStoreBooks,
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
		logo: publisherResolvers.logo,
		authors: publisherResolvers.authors
	},
	Author: {
		publisher: authorResolvers.publisher,
		bio: authorResolvers.bio,
		profileImage: authorResolvers.profileImage,
		bios: authorResolvers.bios,
		collections: authorResolvers.collections,
		series: authorResolvers.series
	},
	StoreBookCollection: {
		author: storeBookCollectionResolvers.author,
		name: storeBookCollectionResolvers.name,
		names: storeBookCollectionResolvers.names,
		storeBooks: storeBookCollectionResolvers.storeBooks
	},
	StoreBookSeries: {
		storeBooks: storeBookSeriesResolvers.storeBooks
	},
	StoreBook: {
		collection: storeBookResolvers.collection,
		cover: storeBookResolvers.cover,
		file: storeBookResolvers.file,
		categories: storeBookResolvers.categories,
		series: storeBookResolvers.series,
		releases: storeBookResolvers.releases,
		inLibrary: storeBookResolvers.inLibrary,
		purchased: storeBookResolvers.purchased
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
