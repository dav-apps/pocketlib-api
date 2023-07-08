import { TableObject, Publisher, PublisherLogo, Author } from "./types.js"

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
		url: `https://dav-backend-dev.fra1.cdn.digitaloceanspaces.com/${obj.uuid}`,
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
		twitterUsername: obj.properties.twitter_username as string
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
