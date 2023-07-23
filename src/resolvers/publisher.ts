import {
	isSuccessStatusCode,
	ApiResponse,
	TableObjectsController
} from "dav-js"
import {
	List,
	UpdateResponse,
	User,
	TableObject,
	Publisher,
	PublisherLogo,
	Author
} from "../types.js"
import {
	getFacebookUsername,
	getInstagramUsername,
	getTwitterUsername,
	convertTableObjectToPublisher,
	convertTableObjectToPublisherLogo,
	convertTableObjectToAuthor
} from "../utils.js"
import { admins } from "../constants.js"
import { getTableObject, listTableObjects } from "../services/apiService.js"
import {
	validateNameLength,
	validateDescriptionLength,
	validateWebsiteUrl
} from "../services/validationService.js"

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

export async function updatePublisher(
	parent: any,
	args: {
		uuid: string
		name?: string
		description?: string
		websiteUrl?: string
		facebookUsername?: string
		instagramUsername?: string
		twitterUsername?: string
	},
	context: any
): Promise<UpdateResponse<Publisher>> {
	const uuid = args.uuid
	if (uuid == null) return null

	let facebookUsername = getFacebookUsername(args.facebookUsername)
	let instagramUsername = getInstagramUsername(args.instagramUsername)
	let twitterUsername = getTwitterUsername(args.twitterUsername)

	let publisherTableObject: TableObject = null
	const user: User = context.user
	const accessToken = context.token as string

	if (uuid == "mine") {
		// Check if the user is a publisher
		if (user == null) {
			throw new Error("not_authenticated")
		} else if (admins.includes(user.id)) {
			throw new Error("action_permitted_for_admins")
		}

		// Get the publisher of the user
		let response = await listTableObjects({
			caching: false,
			limit: 1,
			tableName: "Publisher",
			userId: user.id
		})

		if (response.items.length == 1) {
			publisherTableObject = response.items[0]
		} else {
			return {
				success: false,
				errors: ["action_only_for_publishers"]
			}
		}
	} else {
		// Check if the user is an admin
		if (user == null) {
			throw new Error("not_authenticated")
		} else if (!admins.includes(user.id)) {
			throw new Error("action_permitted")
		}

		// Get the table object
		publisherTableObject = await getTableObject(uuid)

		if (publisherTableObject == null) {
			return {
				success: false,
				errors: ["table_object_does_not_exist"]
			}
		}

		// Check if the table object belongs to the user
		if (publisherTableObject.userId != user.id) {
			throw new Error("action_permitted")
		}
	}

	if (
		args.name == null &&
		args.description == null &&
		args.websiteUrl == null &&
		args.facebookUsername == null &&
		args.instagramUsername == null &&
		args.twitterUsername == null
	) {
		return {
			success: true,
			errors: [],
			item: convertTableObjectToPublisher(publisherTableObject)
		}
	}

	// Validate the args
	let errorMessages: string[] = []

	if (args.name != null) {
		errorMessages.push(validateNameLength(args.name))
	}

	if (args.description != null) {
		errorMessages.push(validateDescriptionLength(args.description))
	}

	if (args.websiteUrl != null) {
		errorMessages.push(validateWebsiteUrl(args.websiteUrl))
	}

	if (args.facebookUsername != null && facebookUsername == null) {
		errorMessages.push("facebook_username_invalid")
	}

	if (args.instagramUsername != null && instagramUsername == null) {
		errorMessages.push("instagram_username_invalid")
	}

	if (args.twitterUsername != null && twitterUsername == null) {
		errorMessages.push("twitter_username_invalid")
	}

	errorMessages = errorMessages.filter(e => e != null)

	if (errorMessages.length > 0) {
		return {
			success: false,
			errors: errorMessages
		}
	}

	// Update the publisher
	let properties = {}

	if (args.name != null) {
		properties["name"] = args.name
	}

	if (args.description != null) {
		properties["description"] = args.description
	}

	if (args.websiteUrl != null) {
		properties["website_url"] = args.websiteUrl
	}

	if (facebookUsername != null) {
		properties["facebook_username"] = facebookUsername
	}

	if (instagramUsername != null) {
		properties["instagram_username"] = instagramUsername
	}

	if (twitterUsername != null) {
		properties["twitter_username"] = twitterUsername
	}

	let updateResponse = await TableObjectsController.UpdateTableObject({
		accessToken,
		uuid: publisherTableObject.uuid,
		properties
	})

	if (!isSuccessStatusCode(updateResponse.status)) {
		return {
			success: false,
			errors: ["unexpected_error"]
		}
	}

	let updateResponseData = (
		updateResponse as ApiResponse<TableObjectsController.TableObjectResponseData>
	).data

	// Convert from TableObjectResponseData to TableObject
	let responseTableObject: TableObject = {
		uuid: updateResponseData.tableObject.Uuid,
		userId: user.id,
		tableId: updateResponseData.tableObject.TableId,
		properties: {}
	}

	for (let key of Object.keys(updateResponseData.tableObject.Properties)) {
		let value = updateResponseData.tableObject.Properties[key]
		responseTableObject.properties[key] = value.value
	}

	let newPublisher = convertTableObjectToPublisher(responseTableObject)

	return {
		success: true,
		errors: [],
		item: newPublisher
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
