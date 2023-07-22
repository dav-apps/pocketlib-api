import {
	ApiResponse,
	ApiErrorResponse,
	isSuccessStatusCode,
	TableObjectsController
} from "dav-js"
import { UpdateResponse, User, TableObject, AuthorBio } from "../types.js"
import {
	convertTableObjectToAuthor,
	convertTableObjectToAuthorBio
} from "../utils.js"
import { admins, authorBioTableId } from "../constants.js"
import { getTableObject, listTableObjects } from "../services/apiService.js"
import {
	runValidations,
	validateBioLength,
	validateLanguage
} from "../services/validationService.js"

export async function setAuthorBio(
	parent: any,
	args: { uuid: string; bio: string; language: string },
	context: any
): Promise<UpdateResponse<AuthorBio>> {
	const uuid = args.uuid
	if (uuid == null) return null

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
			throw new Error("action_not_allowed")
		}

		// Get the author table object
		authorTableObject = await getTableObject(uuid)

		if (authorTableObject == null) {
			return {
				success: false,
				errors: ["table_object_does_not_exist"]
			}
		}

		// Check if the table object belongs to the user
		if (authorTableObject.userId != user.id) {
			throw new Error("action_not_allowed")
		}
	}

	// Validate the args
	let errorMessages = runValidations(
		validateBioLength(args.bio),
		validateLanguage(args.language)
	)

	if (errorMessages.length > 0) {
		return {
			success: false,
			errors: errorMessages
		}
	}

	let author = convertTableObjectToAuthor(authorTableObject)
	let biosString = author.bios

	if (biosString == null) {
		biosString = ""
	}

	// Get all bios
	const bioUuids = biosString.split(",")
	let bios: AuthorBio[] = []

	for (let uuid of bioUuids) {
		let bioObj = await getTableObject(uuid)
		if (bioObj == null) continue

		bios.push(convertTableObjectToAuthorBio(bioObj))
	}

	// Find the bio with the language
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
			return {
				success: false,
				errors: ["unexpected_error"]
			}
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
			return {
				success: false,
				errors: ["unexpected_error"]
			}
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

	let newAuthorBio = convertTableObjectToAuthorBio(responseTableObject)

	return {
		success: true,
		errors: [],
		item: newAuthorBio
	}
}
