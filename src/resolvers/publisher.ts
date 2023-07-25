import {
	isSuccessStatusCode,
	ApiResponse,
	TableObjectsController
} from "dav-js"
import {
	ResolverContext,
	List,
	TableObject,
	Publisher,
	PublisherLogo,
	Author
} from "../types.js"
import {
	throwApiError,
	throwValidationError,
	getFacebookUsername,
	getInstagramUsername,
	getTwitterUsername,
	convertTableObjectToPublisher,
	convertTableObjectToPublisherLogo,
	convertTableObjectToAuthor
} from "../utils.js"
import { admins, publisherTableId } from "../constants.js"
import * as Errors from "../errors.js"
import { getTableObject, listTableObjects } from "../services/apiService.js"
import {
	validateNameLength,
	validateDescriptionLength,
	validateWebsiteUrl
} from "../services/validationService.js"

export async function retrievePublisher(
	parent: any,
	args: { uuid: string },
	context: ResolverContext
): Promise<Publisher> {
	const uuid = args.uuid
	if (uuid == null) return null

	let tableObject: TableObject = null

	if (uuid == "mine") {
		// Check if the user is a publisher
		const user = context.user

		if (user == null) {
			throwApiError(Errors.notAuthenticated)
		} else if (admins.includes(user.id)) {
			throwApiError(Errors.actionPermitted)
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

export async function createPublisher(
	parent: any,
	args: { name: string },
	context: ResolverContext
): Promise<Publisher> {
	const user = context.user
	const accessToken = context.token

	// Check if the user is logged in
	if (user == null) {
		throwApiError(Errors.notAuthenticated)
	}

	let isAdmin = admins.includes(user.id)

	if (!isAdmin) {
		// Check if the user is already a publisher
		let response = await listTableObjects({
			caching: false,
			limit: 1,
			tableName: "Publisher",
			userId: user.id
		})

		if (response.items.length > 0) {
			throwApiError(Errors.actionPermitted)
		}
	}

	// Validate the args
	throwValidationError(validateNameLength(args.name))

	// Create the publisher
	let createResponse = await TableObjectsController.CreateTableObject({
		accessToken,
		tableId: publisherTableId,
		properties: {
			name: args.name
		}
	})

	if (!isSuccessStatusCode(createResponse.status)) {
		throwApiError(Errors.unexpectedError)
	}

	let createResponseData = (
		createResponse as ApiResponse<TableObjectsController.TableObjectResponseData>
	).data

	// Convert from TableObjectResponseData to TableObject
	let responseTableObject: TableObject = {
		uuid: createResponseData.tableObject.Uuid,
		userId: user.id,
		tableId: createResponseData.tableObject.TableId,
		properties: {}
	}

	for (let key of Object.keys(createResponseData.tableObject.Properties)) {
		let value = createResponseData.tableObject.Properties[key]
		responseTableObject.properties[key] = value.value
	}

	return convertTableObjectToPublisher(responseTableObject)
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
	context: ResolverContext
): Promise<Publisher> {
	const uuid = args.uuid
	if (uuid == null) return null

	let facebookUsername = getFacebookUsername(args.facebookUsername)
	let instagramUsername = getInstagramUsername(args.instagramUsername)
	let twitterUsername = getTwitterUsername(args.twitterUsername)

	let publisherTableObject: TableObject = null
	const user = context.user
	const accessToken = context.token

	if (uuid == "mine") {
		// Check if the user is a publisher
		if (user == null) {
			throwApiError(Errors.notAuthenticated)
		} else if (admins.includes(user.id)) {
			throwApiError(Errors.actionPermitted)
		}

		// Get the publisher of the user
		let response = await listTableObjects({
			caching: false,
			limit: 1,
			tableName: "Publisher",
			userId: user.id
		})

		if (response.items.length > 0) {
			publisherTableObject = response.items[0]
		} else {
			throwApiError(Errors.actionPermitted)
		}
	} else {
		// Check if the user is an admin
		if (user == null) {
			throwApiError(Errors.notAuthenticated)
		} else if (!admins.includes(user.id)) {
			throwApiError(Errors.actionPermitted)
		}

		// Get the table object
		publisherTableObject = await getTableObject(uuid)

		if (publisherTableObject == null) {
			throwApiError(Errors.publisherDoesNotExist)
		}

		// Check if the table object belongs to the user
		if (publisherTableObject.userId != user.id) {
			throwApiError(Errors.actionPermitted)
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
		return convertTableObjectToPublisher(publisherTableObject)
	}

	// Validate the args
	let errors: string[] = []

	if (args.name != null) {
		errors.push(validateNameLength(args.name))
	}

	if (args.description != null) {
		errors.push(validateDescriptionLength(args.description))
	}

	if (args.websiteUrl != null) {
		errors.push(validateWebsiteUrl(args.websiteUrl))
	}

	if (args.facebookUsername != null && facebookUsername == null) {
		errors.push(Errors.facebookUsernameInvalid)
	}

	if (args.instagramUsername != null && instagramUsername == null) {
		errors.push(Errors.instagramUsernameInvalid)
	}

	if (args.twitterUsername != null && twitterUsername == null) {
		errors.push(Errors.twitterUsernameInvalid)
	}

	throwValidationError(...errors)

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
		throwApiError(Errors.unexpectedError)
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

	return convertTableObjectToPublisher(responseTableObject)
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
