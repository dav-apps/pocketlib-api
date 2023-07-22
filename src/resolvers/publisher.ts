import {
	List,
	User,
	TableObject,
	Publisher,
	PublisherLogo,
	Author
} from "../types.js"
import {
	convertTableObjectToPublisher,
	convertTableObjectToPublisherLogo,
	convertTableObjectToAuthor
} from "../utils.js"
import { admins } from "../constants.js"
import { getTableObject, listTableObjects } from "../services/apiService.js"

export async function retrievePublisher(
	parent: any,
	args: { uuid: string },
	context: any
): Promise<Publisher> {
	const uuid = args.uuid
	if (uuid == null) return null

	let tableObject: TableObject = null

	if (uuid == "mine") {
		// Check if the user is a publisher
		const user: User = context.user

		if (user == null) {
			throw new Error("You are not authenticated")
		} else if (admins.includes(user.id)) {
			throw new Error("You are an admin")
		}

		// Get the publisher of the user
		let response = await listTableObjects({
			caching: false,
			limit: 1,
			tableName: "Publisher",
			userId: user.id
		})

		if (response.items.length == 1) {
			tableObject = response.items[0]
		} else {
			return null
		}
	} else {
		tableObject = await getTableObject(uuid)
		if (tableObject == null) return null
	}

	return convertTableObjectToPublisher(tableObject)
}

export async function listPublishers(
	parent: any,
	args: { limit?: number; offset?: number }
): Promise<List<Publisher>> {
	let limit = args.limit || 10
	if (limit <= 0) limit = 10

	let offset = args.offset || 0
	if (offset < 0) offset = 0

	let response = await listTableObjects({
		tableName: "Publisher",
		limit,
		offset
	})

	let result: Publisher[] = []

	for (let obj of response.items) {
		result.push(convertTableObjectToPublisher(obj))
	}

	return {
		total: response.total,
		items: result
	}
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
