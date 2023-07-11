export interface ResolverContext {
	token?: string
	user?: User
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
	logo: PublisherLogo | string
	authors: Author[] | string
}

export interface PublisherLogo {
	uuid: string
	url: string
	blurhash: string
}

export interface Author {
	uuid: string
	firstName: string
	lastName: string
	websiteUrl: string
	facebookUsername: string
	instagramUsername: string
	twitterUsername: string
	profileImage: AuthorProfileImage | string
}

export interface AuthorProfileImage {
	uuid: string
	url: string
	blurhash: string
}

export interface StoreBookCollection {
	uuid: string
	author: Author | string
}

export interface StoreBook {
	uuid: string
	collection: StoreBookCollection | string
	title: string
	description: string
	language: string
	price: number
	isbn: string
	status: string
	cover: StoreBookCover | string
	file: StoreBookFile | string
	inLibrary: boolean
	categories: Category[] | string
	releases: StoreBookRelease[] | string
}

export interface StoreBookRelease {
	uuid: string
	storeBook: StoreBook | string
	releaseName: string
	releaseNotes: string
	publishedAt: string
	title: string
	description: string
	price: number
	isbn: string
	status: string
	cover: StoreBookCover | string
	file: StoreBookFile | string
	categories: Category[] | string
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
	names: CategoryName[] | string
}

export interface CategoryName {
	uuid: string
	name: string
	language: string
}
//#endregion
