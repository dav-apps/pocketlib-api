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
	Author,
	AuthorBio,
	AuthorProfileImage,
	StoreBookCollection,
	StoreBookSeries
} from "../types.js"
import {
	getFacebookUsername,
	getInstagramUsername,
	getTwitterUsername,
	convertTableObjectToPublisher,
	convertTableObjectToAuthor,
	convertTableObjectToAuthorBio,
	convertTableObjectToAuthorProfileImage,
	convertTableObjectToStoreBookCollection,
	convertTableObjectToStoreBookSeries
} from "../utils.js"
import { admins } from "../constants.js"
import { getTableObject, listTableObjects } from "../services/apiService.js"
import {
	validateFirstNameLength,
	validateLastNameLength,
	validateWebsiteUrl
} from "../services/validationService.js"

export async function retrieveAuthor(
	parent: any,
	args: { uuid: string },
	context: any
): Promise<Author> {
	const uuid = args.uuid
	if (uuid == null) return null

	let tableObject: TableObject = null

	if (uuid == "mine") {
		// Check if the user is an author
		const user: User = context.user

		if (user == null) {
			throw new Error("You are not authenticated")
		} else if (admins.includes(user.id)) {
			throw new Error("You are an admin")
		}

		// Get the author of the user
		let response = await listTableObjects({
			caching: false,
			limit: 1,
			tableName: "Author",
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

	return convertTableObjectToAuthor(tableObject)
}

export async function listAuthors(
	parent: any,
	args: {
		latest?: boolean
		mine?: boolean
		languages?: string[]
		limit?: number
		offset?: number
	},
	context: any
): Promise<List<Author>> {
	let total = 0
	let tableObjects: TableObject[] = []

	let limit = args.limit || 10
	if (limit <= 0) limit = 10

	let offset = args.offset || 0
	if (offset < 0) offset = 0

	let latest = args.latest || false
	let mine = (args.mine || false) && !latest

	if (latest) {
		let response = await listTableObjects({
			limit,
			offset,
			collectionName: "latest_authors"
		})

		total = response.total
		tableObjects = response.items
	} else if (mine) {
		// Check if the user is an admin
		const user: User = context.user

		if (user == null) {
			throw new Error("not_authenticated")
		} else if (!admins.includes(user.id)) {
			throw new Error("action_permitted")
		}

		// Get the authors of the user
		let response = await listTableObjects({
			userId: user.id,
			tableName: "Author",
			caching: false
		})

		tableObjects = response.items
	} else {
		let response = await listTableObjects({
			limit,
			offset,
			tableName: "Author"
		})

		total = response.total
		tableObjects = response.items
	}

	let result: Author[] = []

	if (mine) {
		for (let obj of tableObjects) {
			let author = convertTableObjectToAuthor(obj)

			if (author.publisher == null) {
				result.push(author)
			}
		}
	} else {
		for (let obj of tableObjects) {
			result.push(convertTableObjectToAuthor(obj))
		}
	}

	if (mine) {
		return {
			total: result.length,
			items: result.slice(offset, limit + offset)
		}
	} else {
		return {
			total,
			items: result
		}
	}
}

export async function updateAuthor(
	parent: any,
	args: {
		uuid: string
		firstName?: string
		lastName?: string
		websiteUrl?: string
		facebookUsername?: string
		instagramUsername?: string
		twitterUsername?: string
	},
	context: any
): Promise<UpdateResponse<Author>> {
	const uuid = args.uuid
	if (uuid == null) return null

	let facebookUsername = getFacebookUsername(args.facebookUsername)
	let instagramUsername = getInstagramUsername(args.instagramUsername)
	let twitterUsername = getTwitterUsername(args.twitterUsername)

	let authorTableObject: TableObject = null
	const user: User = context.user
	const accessToken = context.token as string

	if (uuid == "mine") {
		// Check if the user is an author
		if (user == null) {
			throw new Error("not_authenticated")
		} else if (admins.includes(user.id)) {
			throw new Error("action_permitted_for_admins")
		}

		// Get the author of the user
		let response = await listTableObjects({
			caching: false,
			limit: 1,
			tableName: "Author",
			userId: user.id
		})

		if (response.items.length == 1) {
			authorTableObject = response.items[0]
		} else {
			return {
				success: false,
				errors: ["action_only_for_authors"]
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
		authorTableObject = await getTableObject(uuid)

		if (authorTableObject == null) {
			return {
				success: false,
				errors: ["table_object_does_not_exist"]
			}
		}

		// Check if the table object belongs to the user
		if (authorTableObject.userId != user.id) {
			throw new Error("action_permitted")
		}
	}

	if (
		args.firstName == null &&
		args.lastName == null &&
		args.websiteUrl == null &&
		args.facebookUsername == null &&
		args.instagramUsername == null &&
		args.twitterUsername == null
	) {
		return {
			success: true,
			errors: [],
			item: convertTableObjectToAuthor(authorTableObject)
		}
	}

	// Validate the args
	let errorMessages: string[] = []

	if (args.firstName != null) {
		errorMessages.push(validateFirstNameLength(args.firstName))
	}

	if (args.lastName != null) {
		errorMessages.push(validateLastNameLength(args.lastName))
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

	// Update the author
	let properties = {}

	if (args.firstName != null) {
		properties["first_name"] = args.firstName
	}

	if (args.lastName != null) {
		properties["last_name"] = args.lastName
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
		uuid: authorTableObject.uuid,
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

	let newAuthor = convertTableObjectToAuthor(responseTableObject)

	return {
		success: true,
		errors: [],
		item: newAuthor
	}
}

export async function publisher(author: Author): Promise<Publisher> {
	const uuid = author.publisher
	if (uuid == null) return null

	let tableObject = await getTableObject(uuid)
	if (tableObject == null) return null

	return convertTableObjectToPublisher(tableObject)
}

export async function bio(
	author: Author,
	args: any,
	context: any,
	info: any
): Promise<AuthorBio> {
	const biosString = author.bios
	if (biosString == null) return null

	// Get all bios
	let bioUuids = biosString.split(",")
	let bios: AuthorBio[] = []

	for (let uuid of bioUuids) {
		let bioObj = await getTableObject(uuid)
		if (bioObj == null) continue

		bios.push(convertTableObjectToAuthorBio(bioObj))
	}

	// Find the optimal bio for the given languages
	let languages = info?.variableValues?.languages || ["en"]
	let selectedBios: AuthorBio[] = []

	for (let lang of languages) {
		let bio = bios.find(b => b.language == lang)

		if (bio != null) {
			selectedBios.push(bio)
		}
	}

	if (selectedBios.length > 0) {
		return selectedBios[0]
	}

	return bios[0]
}

export async function profileImage(
	author: Author
): Promise<AuthorProfileImage> {
	const uuid = author.profileImage
	if (uuid == null) return null

	let tableObject = await getTableObject(uuid)
	if (tableObject == null) return null

	return convertTableObjectToAuthorProfileImage(tableObject)
}

export async function bios(
	author: Author,
	args: { limit?: number; offset?: number }
): Promise<List<AuthorBio>> {
	let bioUuidsString = author.bios

	if (bioUuidsString == null) {
		return {
			total: 0,
			items: []
		}
	}

	let limit = args.limit || 10
	if (limit <= 0) limit = 10

	let offset = args.offset || 0
	if (offset < 0) offset = 0

	let bioUuids = bioUuidsString.split(",")
	let bios: AuthorBio[] = []

	for (let uuid of bioUuids) {
		let tableObject = await getTableObject(uuid)
		if (tableObject == null) continue

		bios.push(convertTableObjectToAuthorBio(tableObject))
	}

	return {
		total: bios.length,
		items: bios.slice(offset, limit + offset)
	}
}

export async function collections(
	author: Author,
	args: { limit?: number; offset?: number }
): Promise<List<StoreBookCollection>> {
	let collectionUuidsString = author.collections

	if (collectionUuidsString == null) {
		return {
			total: 0,
			items: []
		}
	}

	let limit = args.limit || 10
	if (limit <= 0) limit = 10

	let offset = args.offset || 0
	if (offset < 0) offset = 0

	let collectionUuids = collectionUuidsString.split(",")
	let collections: StoreBookCollection[] = []

	for (let uuid of collectionUuids) {
		let tableObject = await getTableObject(uuid)
		if (tableObject == null) continue

		collections.push(convertTableObjectToStoreBookCollection(tableObject))
	}

	return {
		total: collections.length,
		items: collections.slice(offset, limit + offset)
	}
}

export async function series(
	author: Author,
	args: { limit?: number; offset?: number }
): Promise<List<StoreBookSeries>> {
	let seriesUuidsString = author.series

	if (seriesUuidsString == null) {
		return {
			total: 0,
			items: []
		}
	}

	let limit = args.limit || 10
	if (limit <= 0) limit = 10

	let offset = args.offset || 0
	if (offset < 0) offset = 0

	let seriesUuids = seriesUuidsString.split(",")
	let series: StoreBookSeries[] = []

	for (let uuid of seriesUuids) {
		let tableObject = await getTableObject(uuid)
		if (tableObject == null) continue

		series.push(convertTableObjectToStoreBookSeries(tableObject))
	}

	return {
		total: series.length,
		items: series.slice(offset, limit + offset)
	}
}
