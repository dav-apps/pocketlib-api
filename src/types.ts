import {
	PrismaClient,
	PublisherLogo as PublisherLogoModel,
	AuthorProfileImage as AuthorProfileImageModel,
	StoreBook as StoreBookModel,
	StoreBookCover as StoreBookCoverModel
} from "@prisma/client"
import { RedisClientType } from "redis"

export interface ResolverContext {
	prisma: PrismaClient
	redis: RedisClientType<any, any, any>
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

export interface UserApiResponse {
	status: number
	data?: User
	errors?: { code: number; message: string }[]
}

//#region Platform models
export interface User {
	id: number
	email: string
	firstName: string
	confirmed: boolean
	totalStorage: number
	usedStorage: number
	plan: number
	dev: boolean
	provider: boolean
	profileImage: string
	profileImageEtag: string
}

export interface TableObject {
	uuid: string
	userId: number
	tableId: number
	properties: { [key: string]: string | number | boolean }
}

export interface TableObjectPrice {
	id: BigInt
	tableObjectUuid: string
	price: number
	currency: Currency
	type: TableObjectPriceType
}

export interface Collection {
	id: number
	tableId: number
	name: string
}

export interface Purchase {
	id: number
	userId: number
	uuid: string
	paymentIntentId: string
	providerName: string
	providerImage: string
	productName: string
	productImage: string
	price: number
	currency: string
	completed: boolean
}

export interface Order {
	uuid: string
	userId: number
	tableObject: TableObject
	shippingAddress: ShippingAddress
	paymentIntentId: string
	price: number
	currency: Currency
	status: OrderStatus
}

export interface ShippingAddress {
	uuid: string
	name: string
	email: string
	phone: string
	city: string
	country: string
	line1: string
	line2: string
	postalCode: string
	state: string
}

export type Currency = "EUR"
export type TableObjectPriceType = "PURCHASE" | "ORDER"
export type OrderStatus = "CREATED" | "PREPARATION" | "SHIPPED"
//#endregion

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

export interface VlbItem {
	__typename: "VlbItem"
	id: string
	isbn: string
	title: string
	description?: string
	price: number
	publisher: string
	author?: {
		firstName: string
		lastName: string
	}
	coverUrl?: string
	collections: {
		id: string
		title: string
	}[]
}
//#endregion
