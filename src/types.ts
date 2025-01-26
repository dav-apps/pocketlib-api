import {
	PrismaClient,
	PublisherLogo as PublisherLogoModel,
	AuthorProfileImage as AuthorProfileImageModel,
	StoreBook as StoreBookModel,
	StoreBookCover as StoreBookCoverModel,
	VlbItem as VlbItemModel,
	VlbAuthor,
	VlbCollection
} from "@prisma/client"
import { RedisClientType } from "redis"
import { Resend } from "resend"
import { User } from "dav-js"

export interface ResolverContext {
	prisma: PrismaClient
	redis: RedisClientType<any, any, any>
	resend: Resend
	accessToken?: string
	user?: User
}

export interface RegexResult {
	valid: boolean
	value: string
}

export interface QueryResult<T> {
	caching: boolean
	data: T
}

export interface List<T> {
	total: number
	items: T[]
}

export interface ApiError {
	code: string
	message: string
	status?: number
}

//#region PocketLib models
export interface PublisherLogo extends PublisherLogoModel {
	url: string
}

export interface AuthorProfileImage extends AuthorProfileImageModel {
	url: string
}

export interface StoreBook extends StoreBookModel {
	title: string
	description: string
	price: number
	printPrice: number
	isbn: string
	luluPrintableId: string
}

export interface StoreBookCover extends StoreBookCoverModel {
	url: string
}

export interface Book {
	uuid: string
	storeBook: string
	file: string
}

export interface VlbItem extends VlbItemModel {
	__typename: "VlbItem"
	isbn: string
	description?: string
	price: number
	language?: string
	publicationDate?: string
	pageCount?: number
	publisher?: VlbPublisher
	author?: VlbAuthor
	coverUrl?: string
	collections: VlbCollection[]
}

export interface VlbPublisher {
	id: string
	name: string
	url: string
}
//#endregion

//#region Vlb API models
export interface VlbGetProductsResponseData {
	content: VlbGetProductsResponseDataItem[]
	totalPages: number
	totalElements: number
}

export interface VlbGetProductsResponseDataItem {
	productId: string
	isbn: string
	title: string
	mainDescription?: string
	priceEurD: number
	publisher: string
	language?: string
	publicationDate?: string
	pages?: number
	pagesArabic?: number
	contributors?: {
		type: string
		firstName: string
		lastName: string
	}[]
	coverUrl?: string
	collections?: VlbGetProductResponseDataCollection[]
}

export interface VlbGetProductResponseData {
	productId: string
	publicationDate?: string
	titles: {
		title: string
		subtitle?: string
		titleType: string
	}[]
	extent?: {
		mainContentPageCount?: number
	}
	contributors?: VlbGetProductResponseDataContributor[]
	identifiers: {
		productIdentifierType: string
		idValue: string
	}[]
	languages: {
		languageRole: string
		languageCode: string
	}[]
	prices: {
		priceType: string
		countriesIncluded: string
		priceAmount: number
		priceStatus: string
	}[]
	publishers: {
		idValue: string
		adbName: string
		publisherName: string
		webSites: {
			websiteRole: string
			websiteLink: string
		}[]
	}[]
	textContents: {
		textType: string
		text: string
	}[]
	supportingResources: {
		resourceContentType: string
		exportedLink: string
	}[]
	collections?: VlbGetProductResponseDataCollection[]
}

export interface VlbGetProductResponseDataContributor {
	isni?: string
	firstName: string
	lastName: string
	contributorRole: string
	biographicalNote?: string
}

export interface VlbGetProductResponseDataCollection {
	collectionId: string
	title: string
}

export interface VlbGetCollectionResponseData {
	content: VlbGetCollectionResponseDataItem[]
	totalPages: number
	totalElements: number
}

export interface VlbGetCollectionResponseDataItem {
	id: string
	title: string
	author: string
	isbn: string
	coverUrl: string
	priceEurD: number
	publicationDate?: string
	publisher: string
}
//#endregion
