export interface TableObject {
	uuid: string
	userId: number
	tableId: number
	properties: { [key: string]: string | number | boolean }
}

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
}
