import {
	isSuccessStatusCode,
	ApiResponse,
	ApiErrorResponse,
	TableObjectsController
} from "dav-js"
import {
	ResolverContext,
	TableObject,
	StoreBookCollectionName
} from "../types.js"
import {
	throwApiError,
	throwValidationError,
	convertTableObjectToStoreBookCollection,
	convertTableObjectToStoreBookCollectionName
} from "../utils.js"
import { apiErrors } from "../errors.js"
import { storeBookCollectionNameTableId } from "../constants.js"
import { getTableObject } from "../services/apiService.js"
import {
	validateNameLength,
	validateLanguage
} from "../services/validationService.js"

export async function setStoreBookCollectionName(
	parent: any,
	args: { uuid: string; name: string; language: string },
	context: ResolverContext
): Promise<StoreBookCollectionName> {
	const uuid = args.uuid
	if (uuid == null) return null

	const user = context.user
	const accessToken = context.token

	// Check if the user is logged in
	if (user == null) {
		throwApiError(apiErrors.notAuthenticated)
	}

	// Get the collection table object
	let collectionTableObject = await getTableObject(uuid)

	if (collectionTableObject == null) {
		throwApiError(apiErrors.storeBookCollectionDoesNotExist)
	}

	// Check if the table object belongs to the user
	if (collectionTableObject.userId != user.id) {
		throwApiError(apiErrors.actionNotAllowed)
	}

	// Validate the args
	throwValidationError(
		validateNameLength(args.name),
		validateLanguage(args.language)
	)

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
			throwApiError(apiErrors.unexpectedError)
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
			throwApiError(apiErrors.unexpectedError)
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
			throwApiError(apiErrors.unexpectedError)
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

	return convertTableObjectToStoreBookCollectionName(responseTableObject)
}
