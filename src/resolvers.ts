import {
	List,
	StoreBookCover,
	StoreBookFile,
	StoreBookRelease,
	Category
} from "./types.js"
import {
	convertTableObjectToStoreBookCover,
	convertTableObjectToStoreBookFile,
	convertTableObjectToCategory
} from "./utils.js"
import { getTableObject } from "./services/apiService.js"
import * as publisherResolvers from "./resolvers/publisher.js"
import * as authorResolvers from "./resolvers/author.js"
import * as storeBookCollectionResolvers from "./resolvers/storeBookCollection.js"
import * as storeBookSeriesResolvers from "./resolvers/storeBookSeries.js"
import * as storeBookResolvers from "./resolvers/storeBook.js"
import * as categoryResolvers from "./resolvers/category.js"

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
		listCategories: categoryResolvers.listCategories
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
		name: categoryResolvers.name,
		names: categoryResolvers.names
	}
}
