import * as publisherResolvers from "./resolvers/publisher.js"
import * as authorResolvers from "./resolvers/author.js"
import * as authorBioResolvers from "./resolvers/authorBio.js"
import * as storeBookCollectionResolvers from "./resolvers/storeBookCollection.js"
import * as storeBookCollectionNameResolvers from "./resolvers/storeBookCollectionName.js"
import * as storeBookSeriesResolvers from "./resolvers/storeBookSeries.js"
import * as storeBookResolvers from "./resolvers/storeBook.js"
import * as storeBookReleaseResolvers from "./resolvers/storeBookRelease.js"
import * as categoryResolvers from "./resolvers/category.js"
import * as bookResolvers from "./resolvers/book.js"

export const resolvers = {
	Query: {
		retrievePublisher: publisherResolvers.retrievePublisher,
		listPublishers: publisherResolvers.listPublishers,
		retrieveAuthor: authorResolvers.retrieveAuthor,
		listAuthors: authorResolvers.listAuthors,
		retrieveStoreBookCollection:
			storeBookCollectionResolvers.retrieveStoreBookCollection,
		retrieveStoreBookSeries: storeBookSeriesResolvers.retrieveStoreBookSeries,
		listStoreBookSeries: storeBookSeriesResolvers.listStoreBookSeries,
		retrieveStoreBook: storeBookResolvers.retrieveStoreBook,
		listStoreBooks: storeBookResolvers.listStoreBooks,
		retrieveStoreBookRelease:
			storeBookReleaseResolvers.retrieveStoreBookRelease,
		listCategories: categoryResolvers.listCategories
	},
	Mutation: {
		createPublisher: publisherResolvers.createPublisher,
		updatePublisher: publisherResolvers.updatePublisher,
		createAuthor: authorResolvers.createAuthor,
		updateAuthor: authorResolvers.updateAuthor,
		setAuthorBio: authorBioResolvers.setAuthorBio,
		setStoreBookCollectionName:
			storeBookCollectionNameResolvers.setStoreBookCollectionName,
		createStoreBookSeries: storeBookSeriesResolvers.createStoreBookSeries,
		updateStoreBookSeries: storeBookSeriesResolvers.updateStoreBookSeries,
		createStoreBook: storeBookResolvers.createStoreBook,
		updateStoreBook: storeBookResolvers.updateStoreBook,
		publishStoreBookRelease:
			storeBookReleaseResolvers.publishStoreBookRelease,
		createBook: bookResolvers.createBook
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
		cover: storeBookReleaseResolvers.cover,
		file: storeBookReleaseResolvers.file,
		categories: storeBookReleaseResolvers.categories
	},
	Category: {
		name: categoryResolvers.name,
		names: categoryResolvers.names
	}
}
