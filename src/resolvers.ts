import { ResolverContext } from "./types.js"
import { cachingResolver } from "./services/cachingService.js"
import * as publisherResolvers from "./resolvers/publisher.js"
import * as authorResolvers from "./resolvers/author.js"
import * as authorBioResolvers from "./resolvers/authorBio.js"
import * as storeBookCollectionResolvers from "./resolvers/storeBookCollection.js"
import * as storeBookCollectionNameResolvers from "./resolvers/storeBookCollectionName.js"
import * as storeBookSeriesResolvers from "./resolvers/storeBookSeries.js"
import * as storeBookResolvers from "./resolvers/storeBook.js"
import * as storeBookReleaseResolvers from "./resolvers/storeBookRelease.js"
import * as checkoutSessionResolvers from "./resolvers/checkoutSession.js"
import * as categoryResolvers from "./resolvers/category.js"
import * as bookResolvers from "./resolvers/book.js"
import * as miscResolvers from "./resolvers/misc.js"

export const resolvers = {
	Query: {
		retrievePublisher: (
			parent: any,
			args: any,
			context: ResolverContext,
			info: any
		) =>
			cachingResolver(
				parent,
				args,
				context,
				info,
				publisherResolvers.retrievePublisher
			),
		listPublishers: (
			parent: any,
			args: any,
			context: ResolverContext,
			info: any
		) =>
			cachingResolver(
				parent,
				args,
				context,
				info,
				publisherResolvers.listPublishers
			),
		retrieveAuthor: (
			parent: any,
			args: any,
			context: ResolverContext,
			info: any
		) =>
			cachingResolver(
				parent,
				args,
				context,
				info,
				authorResolvers.retrieveAuthor
			),
		listAuthors: (
			parent: any,
			args: any,
			context: ResolverContext,
			info: any
		) =>
			cachingResolver(
				parent,
				args,
				context,
				info,
				authorResolvers.listAuthors
			),
		retrieveStoreBookCollection: (
			parent: any,
			args: any,
			context: ResolverContext,
			info: any
		) =>
			cachingResolver(
				parent,
				args,
				context,
				info,
				storeBookCollectionResolvers.retrieveStoreBookCollection
			),
		retrieveStoreBookCollectionName: (
			parent: any,
			args: any,
			context: ResolverContext,
			info: any
		) =>
			cachingResolver(
				parent,
				args,
				context,
				info,
				storeBookCollectionNameResolvers.retrieveStoreBookCollectionName
			),
		retrieveStoreBookSeries: (
			parent: any,
			args: any,
			context: ResolverContext,
			info: any
		) =>
			cachingResolver(
				parent,
				args,
				context,
				info,
				storeBookSeriesResolvers.retrieveStoreBookSeries
			),
		listStoreBookSeries: (
			parent: any,
			args: any,
			context: ResolverContext,
			info: any
		) =>
			cachingResolver(
				parent,
				args,
				context,
				info,
				storeBookSeriesResolvers.listStoreBookSeries
			),
		retrieveStoreBook: (
			parent: any,
			args: any,
			context: ResolverContext,
			info: any
		) =>
			cachingResolver(
				parent,
				args,
				context,
				info,
				storeBookResolvers.retrieveStoreBook
			),
		listStoreBooks: (
			parent: any,
			args: any,
			context: ResolverContext,
			info: any
		) =>
			cachingResolver(
				parent,
				args,
				context,
				info,
				storeBookResolvers.listStoreBooks
			),
		retrieveStoreBookRelease: (
			parent: any,
			args: any,
			context: ResolverContext,
			info: any
		) =>
			cachingResolver(
				parent,
				args,
				context,
				info,
				storeBookReleaseResolvers.retrieveStoreBookRelease
			),
		retrieveCategory: (
			parent: any,
			args: any,
			context: ResolverContext,
			info: any
		) =>
			cachingResolver(
				parent,
				args,
				context,
				info,
				categoryResolvers.retrieveCategory
			),
		listCategories: (
			parent: any,
			args: any,
			context: ResolverContext,
			info: any
		) =>
			cachingResolver(
				parent,
				args,
				context,
				info,
				categoryResolvers.listCategories
			),
		search: (parent: any, args: any, context: ResolverContext, info: any) =>
			cachingResolver(parent, args, context, info, miscResolvers.search)
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
		createCheckoutSession: checkoutSessionResolvers.createCheckoutSession,
		createBook: bookResolvers.createBook
	},
	Publisher: {
		logo: (parent: any, args: any, context: ResolverContext, info: any) =>
			cachingResolver(parent, args, context, info, publisherResolvers.logo),
		authors: (parent: any, args: any, context: ResolverContext, info: any) =>
			cachingResolver(
				parent,
				args,
				context,
				info,
				publisherResolvers.authors
			)
	},
	Author: {
		publisher: (
			parent: any,
			args: any,
			context: ResolverContext,
			info: any
		) =>
			cachingResolver(
				parent,
				args,
				context,
				info,
				authorResolvers.publisher
			),
		bio: (parent: any, args: any, context: ResolverContext, info: any) =>
			cachingResolver(parent, args, context, info, authorResolvers.bio),
		profileImage: (
			parent: any,
			args: any,
			context: ResolverContext,
			info: any
		) =>
			cachingResolver(
				parent,
				args,
				context,
				info,
				authorResolvers.profileImage
			),
		bios: (parent: any, args: any, context: ResolverContext, info: any) =>
			cachingResolver(parent, args, context, info, authorResolvers.bios),
		collections: (
			parent: any,
			args: any,
			context: ResolverContext,
			info: any
		) =>
			cachingResolver(
				parent,
				args,
				context,
				info,
				authorResolvers.collections
			),
		series: (parent: any, args: any, context: ResolverContext, info: any) =>
			cachingResolver(parent, args, context, info, authorResolvers.series)
	},
	StoreBookCollection: {
		author: (parent: any, args: any, context: ResolverContext, info: any) =>
			cachingResolver(
				parent,
				args,
				context,
				info,
				storeBookCollectionResolvers.author
			),
		name: (parent: any, args: any, context: ResolverContext, info: any) =>
			cachingResolver(
				parent,
				args,
				context,
				info,
				storeBookCollectionResolvers.name
			),
		names: (parent: any, args: any, context: ResolverContext, info: any) =>
			cachingResolver(
				parent,
				args,
				context,
				info,
				storeBookCollectionResolvers.names
			),
		storeBooks: (
			parent: any,
			args: any,
			context: ResolverContext,
			info: any
		) =>
			cachingResolver(
				parent,
				args,
				context,
				info,
				storeBookCollectionResolvers.storeBooks
			)
	},
	StoreBookSeries: {
		storeBooks: (
			parent: any,
			args: any,
			context: ResolverContext,
			info: any
		) =>
			cachingResolver(
				parent,
				args,
				context,
				info,
				storeBookSeriesResolvers.storeBooks
			)
	},
	StoreBook: {
		collection: (
			parent: any,
			args: any,
			context: ResolverContext,
			info: any
		) =>
			cachingResolver(
				parent,
				args,
				context,
				info,
				storeBookResolvers.collection
			),
		cover: (parent: any, args: any, context: ResolverContext, info: any) =>
			cachingResolver(parent, args, context, info, storeBookResolvers.cover),
		file: (parent: any, args: any, context: ResolverContext, info: any) =>
			cachingResolver(parent, args, context, info, storeBookResolvers.file),
		printCover: (
			parent: any,
			args: any,
			context: ResolverContext,
			info: any
		) =>
			cachingResolver(
				parent,
				args,
				context,
				info,
				storeBookResolvers.printCover
			),
		printFile: (
			parent: any,
			args: any,
			context: ResolverContext,
			info: any
		) =>
			cachingResolver(
				parent,
				args,
				context,
				info,
				storeBookResolvers.printFile
			),
		categories: (
			parent: any,
			args: any,
			context: ResolverContext,
			info: any
		) =>
			cachingResolver(
				parent,
				args,
				context,
				info,
				storeBookResolvers.categories
			),
		series: (parent: any, args: any, context: ResolverContext, info: any) =>
			cachingResolver(
				parent,
				args,
				context,
				info,
				storeBookResolvers.series
			),
		releases: (parent: any, args: any, context: ResolverContext, info: any) =>
			cachingResolver(
				parent,
				args,
				context,
				info,
				storeBookResolvers.releases
			),
		inLibrary: storeBookResolvers.inLibrary,
		purchased: storeBookResolvers.purchased
	},
	StoreBookRelease: {
		cover: (parent: any, args: any, context: ResolverContext, info: any) =>
			cachingResolver(
				parent,
				args,
				context,
				info,
				storeBookReleaseResolvers.cover
			),
		file: (parent: any, args: any, context: ResolverContext, info: any) =>
			cachingResolver(
				parent,
				args,
				context,
				info,
				storeBookReleaseResolvers.file
			),
		printCover: (
			parent: any,
			args: any,
			context: ResolverContext,
			info: any
		) =>
			cachingResolver(
				parent,
				args,
				context,
				info,
				storeBookReleaseResolvers.printCover
			),
		printFile: (
			parent: any,
			args: any,
			context: ResolverContext,
			info: any
		) =>
			cachingResolver(
				parent,
				args,
				context,
				info,
				storeBookReleaseResolvers.printFile
			),
		categories: (
			parent: any,
			args: any,
			context: ResolverContext,
			info: any
		) =>
			cachingResolver(
				parent,
				args,
				context,
				info,
				storeBookReleaseResolvers.categories
			)
	},
	Category: {
		name: (parent: any, args: any, context: ResolverContext, info: any) =>
			cachingResolver(parent, args, context, info, categoryResolvers.name),
		names: (parent: any, args: any, context: ResolverContext, info: any) =>
			cachingResolver(parent, args, context, info, categoryResolvers.names)
	}
}
