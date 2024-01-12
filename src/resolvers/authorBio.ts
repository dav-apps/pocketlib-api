import { Author, AuthorBio } from "@prisma/client"
import * as crypto from "crypto"
import { ResolverContext } from "../types.js"
import { throwApiError, throwValidationError } from "../utils.js"
import { apiErrors } from "../errors.js"
import { admins } from "../constants.js"
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

	let author: Author = null
	const user = context.user

	if (uuid == "mine") {
		// Check if the user is an author
		if (user == null) {
			throwApiError(apiErrors.notAuthenticated)
		} else if (admins.includes(user.id)) {
			throwApiError(apiErrors.actionNotAllowed)
		}

		// Get the author of the user
		author = await context.prisma.author.findFirst({
			where: { userId: user.id }
		})

		if (author == null) {
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
		author = await context.prisma.author.findFirst({ where: { uuid } })

		if (author == null) {
			throwApiError(apiErrors.authorDoesNotExist)
		}
	}

	// Validate the args
	throwValidationError(
		validateBioLength(args.bio),
		validateLanguage(args.language)
	)

	// Find the bio with the given language
	let bio = await context.prisma.authorBio.findFirst({
		where: { authorId: author.id, language: args.language }
	})

	if (bio == null) {
		// Create a new AuthorBio
		return await context.prisma.authorBio.create({
			data: {
				uuid: crypto.randomUUID(),
				userId: user.id,
				author: {
					connect: {
						id: author.id
					}
				},
				bio: args.bio,
				language: args.language
			}
		})
	} else {
		// Update the existing AuthorBio
		return await context.prisma.authorBio.update({
			where: { id: bio.id },
			data: {
				bio: args.bio
			}
		})
	}
}
