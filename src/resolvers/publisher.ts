import { List, Publisher, PublisherLogo, Author } from "../types.js"
import {
	convertTableObjectToPublisher,
	convertTableObjectToPublisherLogo,
	convertTableObjectToAuthor
} from "../utils.js"
import { getTableObject } from "../services/apiService.js"

export async function retrievePublisher(
	parent: any,
	args: { uuid: string }
): Promise<Publisher> {
	const uuid = args.uuid
	if (uuid == null) return null

	let tableObject = await getTableObject(uuid)
	if (tableObject == null) return null

	return convertTableObjectToPublisher(tableObject)
}

export async function logo(publisher: Publisher): Promise<PublisherLogo> {
	const uuid = publisher.logo
	if (uuid == null) return null

	let tableObject = await getTableObject(uuid)
	if (tableObject == null) return null

	return convertTableObjectToPublisherLogo(tableObject)
}

export async function authors(
	publisher: Publisher,
	args: { limit?: number; offset?: number }
): Promise<List<Author>> {
	if (publisher.authors == null) {
		return {
			total: 0,
			items: []
		}
	}

	let limit = args.limit || 10
	if (limit <= 0) limit = 10

	let offset = args.offset || 0
	if (offset < 0) offset = 0

	let authorUuids = publisher.authors.split(",")
	let authors: Author[] = []

	for (let uuid of authorUuids) {
		let author = await getTableObject(uuid)
		if (author == null) continue

		authors.push(convertTableObjectToAuthor(author))
	}

	return {
		total: authors.length,
		items: authors.slice(offset, limit + offset)
	}
}
