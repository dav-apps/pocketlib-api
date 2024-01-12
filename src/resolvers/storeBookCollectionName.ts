import { StoreBookCollectionName } from "@prisma/client"
import * as crypto from "crypto"
import { ResolverContext } from "../types.js"
import { throwApiError, throwValidationError } from "../utils.js"
import { apiErrors } from "../errors.js"
import {
	validateNameLength,
	validateLanguage
} from "../services/validationService.js"

export async function retrieveStoreBookCollectionName(
	parent: any,
	args: { uuid: string },
	context: ResolverContext
): Promise<StoreBookCollectionName> {
	const uuid = args.uuid
	if (uuid == null) return null

	return await context.prisma.storeBookCollectionName.findFirst({
		where: { uuid }
	})
}

export async function setStoreBookCollectionName(
	parent: any,
	args: { uuid: string; name: string; language: string },
	context: ResolverContext
): Promise<StoreBookCollectionName> {
	const uuid = args.uuid
	if (uuid == null) return null

	const user = context.user

	if (user == null) {
		throwApiError(apiErrors.notAuthenticated)
	}

	// Get the collection
	let collection = await context.prisma.storeBookCollection.findFirst({
		where: { uuid: args.uuid }
	})

	// Check if the collection belongs to the user
	if (collection.userId != BigInt(user.id)) {
		throwApiError(apiErrors.actionNotAllowed)
	}

	// Validate the args
	throwValidationError(
		validateNameLength(args.name),
		validateLanguage(args.language)
	)

	// Find the name with the given language
	let name = await context.prisma.storeBookCollectionName.findFirst({
		where: { collectionId: collection.id, language: args.language }
	})

	if (name == null) {
		// Create a new StoreBookCollectionName
		name = await context.prisma.storeBookCollectionName.create({
			data: {
				uuid: crypto.randomUUID(),
				userId: user.id,
				collection: {
					connect: {
						id: collection.id
					}
				},
				name: args.name,
				language: args.language
			}
		})
	} else {
		// Update the existing StoreBookCollectionName
		name = await context.prisma.storeBookCollectionName.update({
			where: { id: name.id },
			data: {
				name: args.name
			}
		})
	}

	return name
}
