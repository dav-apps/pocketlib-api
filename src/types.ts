export interface ResolverContext {
	token?: string
	user?: User
}

export interface List<T> {
	total: number
	items: T[]
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
//#endregion

//#region PocketLib models
export interface Publisher {
	uuid: string
	name: string
	description: string
	websiteUrl: string
	facebookUsername: string
	instagramUsername: string
	twitterUsername: string
	logo: string
	authors: string
}

export interface PublisherLogo {
	uuid: string
	url: string
	blurhash: string
}

export interface Author {
	uuid: string
	publisher: string
	firstName: string
	lastName: string
	websiteUrl: string
	facebookUsername: string
	instagramUsername: string
	twitterUsername: string
	profileImage: string
	bios: string
	collections: string
	series: string
}

export interface AuthorBio {
	uuid: string
	bio: string
	language: string
}

export interface AuthorProfileImage {
	uuid: string
	url: string
	blurhash: string
}

export interface StoreBookCollection {
	uuid: string
	author: string
	names: string
	storeBooks: string
}

export interface StoreBookCollectionName {
	uuid: string
	name: string
	language: string
}

export interface StoreBookSeries {
	uuid: string
	author: string
	name: string
	language: string
	storeBooks: string
}

export interface StoreBook {
	uuid: string
	collection: string
	title: string
	description: string
	language: string
	price: number
	isbn: string
	status: string
	cover: string
	file: string
	categories: string
	releases: string
	inLibrary: boolean
	purchased: boolean
}

export interface StoreBookRelease {
	uuid: string
	storeBook: string
	releaseName: string
	releaseNotes: string
	publishedAt: string
	title: string
	description: string
	price: number
	isbn: string
	status: string
	cover: string
	file: string
	categories: string
}

export interface StoreBookCover {
	uuid: string
	url: string
	aspectRatio: string
	blurhash: string
}

export interface StoreBookFile {
	uuid: string
	fileName: string
}

export interface Category {
	uuid: string
	key: string
	names: string
}

export interface CategoryName {
	uuid: string
	name: string
	language: string
}
//#endregion
