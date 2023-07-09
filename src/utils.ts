import {
	TableObject,
	Publisher,
	PublisherLogo,
	Author,
	AuthorProfileImage,
	StoreBookCollection,
	StoreBook,
	StoreBookRelease,
	StoreBookCover,
	StoreBookFile,
	Category,
	CategoryName
} from "./types.js"

export function convertTableObjectToPublisher(obj: TableObject): Publisher {
	return {
		uuid: obj.uuid,
		name: obj.properties.name as string,
		description: obj.properties.description as string,
		websiteUrl: obj.properties.website_url as string,
		facebookUsername: obj.properties.facebook_username as string,
		instagramUsername: obj.properties.instagram_username as string,
		twitterUsername: obj.properties.twitter_username as string,
		logo: obj.properties.logo as string,
		authors: obj.properties.authors as string
	}
}

export function convertTableObjectToPublisherLogo(
	obj: TableObject
): PublisherLogo {
	return {
		uuid: obj.uuid,
		url: `https://dav-backend.fra1.cdn.digitaloceanspaces.com/${obj.uuid}`,
		blurhash: obj.properties.blurhash as string
	}
}

export function convertTableObjectToAuthor(obj: TableObject): Author {
	return {
		uuid: obj.uuid,
		firstName: obj.properties.first_name as string,
		lastName: obj.properties.last_name as string,
		websiteUrl: obj.properties.website_url as string,
		facebookUsername: obj.properties.facebook_username as string,
		instagramUsername: obj.properties.instagram_username as string,
		twitterUsername: obj.properties.twitter_username as string,
		profileImage: obj.properties.profile_image as string
	}
}

export function convertTableObjectToAuthorProfileImage(
	obj: TableObject
): AuthorProfileImage {
	return {
		uuid: obj.uuid,
		url: `https://dav-backend.fra1.cdn.digitaloceanspaces.com/${obj.uuid}`,
		blurhash: obj.properties.blurhash as string
	}
}

export function convertTableObjectToStoreBookCollection(
	obj: TableObject
): StoreBookCollection {
	return {
		uuid: obj.uuid,
		author: obj.properties.author as string
	}
}

export function convertTableObjectToStoreBook(obj: TableObject): StoreBook {
	return {
		uuid: obj.uuid,
		collection: obj.properties.collection as string,
		title: null,
		description: null,
		language: obj.properties.language as string,
		price: null,
		isbn: null,
		status: obj.properties.status as string,
		cover: null,
		file: null,
		categories: null,
		releases: obj.properties.releases as string
	}
}

export function convertTableObjectToStoreBookRelease(
	obj: TableObject
): StoreBookRelease {
	return {
		uuid: obj.uuid,
		storeBook: obj.properties.store_book as string,
		releaseName: obj.properties.release_name as string,
		releaseNotes: obj.properties.release_notes as string,
		publishedAt: obj.properties.published_at as string,
		title: obj.properties.title as string,
		description: obj.properties.description as string,
		price: obj.properties.price as number,
		isbn: obj.properties.isbn as string,
		status: obj.properties.status as string,
		categories: obj.properties.categories as string
	}
}

export function convertTableObjectToStoreBookCover(
	obj: TableObject
): StoreBookCover {
	return {
		uuid: obj.uuid
	}
}

export function convertTableObjectToStoreBookFile(
	obj: TableObject
): StoreBookFile {
	return {
		uuid: obj.uuid
	}
}

export function convertTableObjectToCategory(obj: TableObject): Category {
	return {
		uuid: obj.uuid,
		key: obj.properties.key as string,
		names: obj.properties.names as string
	}
}

export function convertTableObjectToCategoryName(
	obj: TableObject
): CategoryName {
	return {
		uuid: obj.uuid,
		name: obj.properties.name as string,
		language: obj.properties.language as string
	}
}
