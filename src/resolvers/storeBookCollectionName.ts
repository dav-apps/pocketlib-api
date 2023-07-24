import {
	isSuccessStatusCode,
	ApiResponse,
	ApiErrorResponse,
	TableObjectsController
} from "dav-js"
import {
	UpdateResponse,
	User,
	TableObject,
	StoreBookCollectionName
} from "../types.js"
import {
	throwApiError,
	convertTableObjectToStoreBookCollection,
	convertTableObjectToStoreBookCollectionName
} from "../utils.js"
import * as Errors from "../errors.js"
import { storeBookCollectionNameTableId } from "../constants.js"
import { getTableObject } from "../services/apiService.js"
import {
	validateNameLength,
	validateLanguage
} from "../services/validationService.js"

export async function setStoreBookCollectionName(
	parent: any,
	args: { uuid: string; name: string; language: string },
	context: any
): Promise<UpdateResponse<StoreBookCollectionName>> {
	const uuid = args.uuid
	if (uuid == null) return null

	const user: User = context.user
	const accessToken = context.token as string

	// Check if the user is logged in
	if (user == null) {
		throwApiError(Errors.notAuthenticated)
	}

	// Get the collection table object
	let collectionTableObject = await getTableObject(uuid)

	if (collectionTableObject == null) {
		return {
			success: false,
			errors: ["table_object_does_not_exist"]
		}
	}

	// Check if the table object belongs to the user
	if (collectionTableObject.userId != user.id) {
		throwApiError(Errors.actionPermitted)
	}

	// Validate the args
	let errorMessages = [
		validateNameLength(args.name),
		validateLanguage(args.language)
	].filter(e => e != null)

	if (errorMessages.length > 0) {
		return {
			success: false,
			errors: errorMessages
		}
	}

	let collection = convertTableObjectToStoreBookCollection(
		collectionTableObject
	)
	let namesString = collection.names || ""

	// Get all names
	const nameUuids = namesString.split(",")
	let names: StoreBookCollectionName[] = []

	for (let nameUuid of nameUuids) {
		let nameObj = await getTableObject(nameUuid)
		if (nameObj == null) continue

		names.push(convertTableObjectToStoreBookCollectionName(nameObj))
	}

	// Find the name with the given language
	let name = names.find(n => n.language == args.language)
	let response:
		| ApiResponse<TableObjectsController.TableObjectResponseData>
		| ApiErrorResponse = null

	if (name == null) {
		// Create a new StoreBookCollectionName
		response = await TableObjectsController.CreateTableObject({
			accessToken,
			tableId: storeBookCollectionNameTableId,
			properties: {
				name: args.name,
				language: args.language
			}
		})

		if (!isSuccessStatusCode(response.status)) {
			return {
				success: false,
				errors: ["unexpected_error"]
			}
		}
	} else {
		// Update the existing StoreBookCollectionName
		response = await TableObjectsController.UpdateTableObject({
			accessToken,
			uuid: name.uuid,
			properties: {
				name: args.name
			}
		})

		if (!isSuccessStatusCode(response.status)) {
			return {
				success: false,
				errors: ["unexpected_error"]
			}
		}
	}

	let responseData = (
		response as ApiResponse<TableObjectsController.TableObjectResponseData>
	).data

	if (name == null) {
		// Add the new name to the names of the collection
		if (namesString.length == 0) {
			namesString = responseData.tableObject.Uuid
		} else {
			namesString += `,${responseData.tableObject.Uuid}`
		}

		// Update the collection table object
		let updateCollectionTableObjectResponse =
			await TableObjectsController.UpdateTableObject({
				accessToken,
				uuid: collectionTableObject.uuid,
				properties: {
					names: namesString
				}
			})

		if (!isSuccessStatusCode(updateCollectionTableObjectResponse.status)) {
			return {
				success: false,
				errors: ["unexpected_error"]
			}
		}
	}

	// Convert from TableObjectResponseData to TableObject
	let responseTableObject: TableObject = {
		uuid: responseData.tableObject.Uuid,
		userId: user.id,
		tableId: responseData.tableObject.TableId,
		properties: {}
	}

	for (let key of Object.keys(responseData.tableObject.Properties)) {
		let value = responseData.tableObject.Properties[key]
		responseTableObject.properties[key] = value.value
	}

	let newCollectionName =
		convertTableObjectToStoreBookCollectionName(responseTableObject)

	return {
		success: true,
		errors: [],
		item: newCollectionName
	}
}
