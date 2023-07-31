import { isSuccessStatusCode, TableObjectsController } from "dav-js"
import {
	ResolverContext,
	List,
	StoreBookRelease,
	StoreBookCover,
	StoreBookFile,
	Category
} from "../types.js"
import {
	throwApiError,
	throwValidationError,
	convertTableObjectToStoreBookCover,
	convertTableObjectToStoreBookFile,
	convertTableObjectToStoreBookRelease,
	convertTableObjectToCategory
} from "../utils.js"
import { admins } from "../constants.js"
import { apiErrors } from "../errors.js"
import { getTableObject } from "../services/apiService.js"
import {
	validateReleaseNameLength,
	validateReleaseNotesLength
} from "../services/validationService.js"

export async function publishStoreBookRelease(
	parent: any,
	args: {
		uuid: string
		releaseName: string
		releaseNotes?: string
	},
	context: ResolverContext
): Promise<StoreBookRelease> {
	const uuid = args.uuid
	if (uuid == null) return null

	const accessToken = context.accessToken
	const user = context.user

	if (user == null) {
		throwApiError(apiErrors.notAuthenticated)
	}

	const isAdmin = admins.includes(user.id)

	// Get the store book release
	let storeBookReleaseTableObject = await getTableObject(uuid)

	if (storeBookReleaseTableObject == null) {
		throwApiError(apiErrors.storeBookReleaseDoesNotExist)
	}

	// Check if the release belongs to the user
	if (user.id != storeBookReleaseTableObject.userId && !isAdmin) {
		throwApiError(apiErrors.actionNotAllowed)
	}

	// Check if the release is unpublished
	if (storeBookReleaseTableObject.properties.status == "published") {
		throwApiError(apiErrors.storeBookReleaseAlreadyPublished)
	}

	// Get the store book
	let storeBookUuid = storeBookReleaseTableObject.properties
		.store_book as string

	if (storeBookUuid == null) {
		throwApiError(apiErrors.unexpectedError)
	}

	let storeBookTableObject = await getTableObject(storeBookUuid)

	if (storeBookTableObject == null) {
		throwApiError(apiErrors.unexpectedError)
	}

	// Check if the store book is published or hidden
	let storeBookStatus = storeBookTableObject.properties.status

	if (storeBookStatus != "published" && storeBookStatus != "hidden") {
		throwApiError(apiErrors.storeBookNotPublished)
	}

	// Validate args
	let errors: string[] = [validateReleaseNameLength(args.releaseName)]

	if (args.releaseNotes != null) {
		errors.push(validateReleaseNotesLength(args.releaseNotes))
	}

	throwValidationError(...errors)

	// Publish the release
	let releaseProperties = {
		status: "published",
		release_name: args.releaseName,
		published_at: Math.floor(Date.now() / 1000)
	}

	if (args.releaseNotes != null) {
		releaseProperties["release_notes"] = args.releaseNotes
	}

	let updateReleaseResponse = await TableObjectsController.UpdateTableObject({
		accessToken,
		uuid: storeBookReleaseTableObject.uuid,
		properties: releaseProperties
	})

	if (!isSuccessStatusCode(updateReleaseResponse.status)) {
		throwApiError(apiErrors.unexpectedError)
	}

	// Update the local release table object & return it
	for (let key of Object.keys(releaseProperties)) {
		storeBookReleaseTableObject.properties[key] = releaseProperties[key]
	}

	return convertTableObjectToStoreBookRelease(storeBookReleaseTableObject)
}

export async function cover(
	storeBookRelease: StoreBookRelease
): Promise<StoreBookCover> {
	const uuid = storeBookRelease.cover
	if (uuid == null) return null

	let tableObject = await getTableObject(uuid)
	if (tableObject == null) return null

	return convertTableObjectToStoreBookCover(tableObject)
}

export async function file(
	storeBookRelease: StoreBookRelease
): Promise<StoreBookFile> {
	const uuid = storeBookRelease.file
	if (uuid == null) return null

	let tableObject = await getTableObject(uuid)
	if (tableObject == null) return null

	return convertTableObjectToStoreBookFile(tableObject)
}

export async function categories(
	storeBookRelease: StoreBookRelease,
	args: { limit?: number; offset?: number }
): Promise<List<Category>> {
	let categoryUuidsString = storeBookRelease.categories

	if (categoryUuidsString == null) {
		return {
			total: 0,
			items: []
		}
	}

	let limit = args.limit || 10
	if (limit <= 0) limit = 10

	let offset = args.offset || 0
	if (offset < 0) offset = 0

	let categoryUuids = categoryUuidsString.split(",")
	let categories: Category[] = []

	for (let uuid of categoryUuids) {
		let tableObject = await getTableObject(uuid)
		if (tableObject == null) continue

		categories.push(convertTableObjectToCategory(tableObject))
	}

	return {
		total: categories.length,
		items: categories.slice(offset, limit + offset)
	}
}
