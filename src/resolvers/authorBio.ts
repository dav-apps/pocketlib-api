import {
	ApiResponse,
	ApiErrorResponse,
	isSuccessStatusCode,
	TableObjectsController
} from "dav-js"
import { ResolverContext, TableObject, AuthorBio } from "../types.js"
import {
	throwApiError,
	throwValidationError,
	convertTableObjectToAuthor,
	convertTableObjectToAuthorBio
} from "../utils.js"
import { apiErrors } from "../errors.js"
import { admins, authorBioTableId } from "../constants.js"
import { getTableObject, listTableObjects } from "../services/apiService.js"
import {
	validateBioLength,
	validateLanguage
} from "../services/validationService.js"

export async function setAuthorBio(
	parent: any,
	args: { uuid: string; bio: string; language: string },
	context: ResolverContext
): Promise<AuthorBio> {
	const uuid = args.uuid
	if (uuid == null) return null

	let authorTableObject: TableObject = null
	const user = context.user
	const accessToken = context.token

	if (uuid == "mine") {
		// Check if the user is an author
		if (user == null) {
			throwApiError(apiErrors.notAuthenticated)
		} else if (admins.includes(user.id)) {
			throwApiError(apiErrors.actionNotAllowed)
		}

		// Get the author of the user
		let response = await listTableObjects({
			caching: false,
			limit: 1,
			tableName: "Author",
			userId: user.id
		})

		if (response.items.length > 0) {
			authorTableObject = response.items[0]
		} else {
			throwApiError(apiErrors.actionNotAllowed)
		}
	} else {
		// Check if the user is an admin
		if (user == null) {
			throwApiError(apiErrors.notAuthenticated)
		} else if (!admins.includes(user.id)) {
			throwApiError(apiErrors.actionNotAllowed)
		}

		// Get the author table object
		authorTableObject = await getTableObject(uuid)

		if (authorTableObject == null) {
			throwApiError(apiErrors.authorDoesNotExist)
		}

		// Check if the table object belongs to the user
		if (authorTableObject.userId != user.id) {
			throwApiError(apiErrors.actionNotAllowed)
		}
	}

	// Validate the args
	throwValidationError(
		validateBioLength(args.bio),
		validateLanguage(args.language)
	)

	let author = convertTableObjectToAuthor(authorTableObject)
	let biosString = author.bios || ""

	// Get all bios
	const bioUuids = biosString.split(",")
	let bios: AuthorBio[] = []

	for (let bioUuid of bioUuids) {
		let bioObj = await getTableObject(bioUuid)
		if (bioObj == null) continue

		bios.push(convertTableObjectToAuthorBio(bioObj))
	}

	// Find the bio with the given language
	let bio = bios.find(b => b.language == args.language)
	let response:
		| ApiResponse<TableObjectsController.TableObjectResponseData>
		| ApiErrorResponse = null

	if (bio == null) {
		// Create a new AuthorBio
		response = await TableObjectsController.CreateTableObject({
			accessToken,
			tableId: authorBioTableId,
			properties: {
				bio: args.bio,
				language: args.language
			}
		})

		if (!isSuccessStatusCode(response.status)) {
			throwApiError(apiErrors.unexpectedError)
		}
	} else {
		// Update the existing AuthorBio
		response = await TableObjectsController.UpdateTableObject({
			accessToken,
			uuid: bio.uuid,
			properties: {
				bio: args.bio
			}
		})

		if (!isSuccessStatusCode(response.status)) {
			throwApiError(apiErrors.unexpectedError)
		}
	}

	let responseData = (
		response as ApiResponse<TableObjectsController.TableObjectResponseData>
	).data

	if (bio == null) {
		// Add the new bio to the bios of the author
		if (biosString.length == 0) {
			biosString = responseData.tableObject.Uuid
		} else {
			biosString += `,${responseData.tableObject.Uuid}`
		}

		// Update the author table object
		let updateAuthorTableObjectResponse =
			await TableObjectsController.UpdateTableObject({
				accessToken,
				uuid: authorTableObject.uuid,
				properties: {
					bios: biosString
				}
			})

		if (!isSuccessStatusCode(updateAuthorTableObjectResponse.status)) {
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

	return convertTableObjectToAuthorBio(responseTableObject)
}
