import { Publisher, Author } from "@prisma/client"
import * as crypto from "crypto"
import { ResolverContext, List, PublisherLogo } from "../types.js"
import {
	throwApiError,
	throwValidationError,
	getFacebookUsername,
	getInstagramUsername,
	getTwitterUsername,
	getTableObjectFileUrl
} from "../utils.js"
import { admins } from "../constants.js"
import { apiErrors, validationErrors } from "../errors.js"
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

	let where = {}

	if (uuid == "mine") {
		// Check if the user is a publisher
		const user = context.user

		if (user == null) {
			throwApiError(apiErrors.notAuthenticated)
		} else if (admins.includes(user.id)) {
			throwApiError(apiErrors.actionNotAllowed)
		}

		// Get the publisher of the user
		where = { userId: user.id }
	} else {
		where = { uuid }
	}

	return await context.prisma.publisher.findFirst({ where })
}

export async function listPublishers(
	parent: any,
	args: { limit?: number; offset?: number },
	context: ResolverContext
): Promise<List<Publisher>> {
	let take = args.limit || 10
	if (take <= 0) take = 10

	let skip = args.offset || 0
	if (skip < 0) skip = 0

	const [total, items] = await context.prisma.$transaction([
		context.prisma.publisher.count(),
		context.prisma.publisher.findMany({
			take,
			skip
		})
	])

	return {
		total,
		items
	}
}

export async function createPublisher(
	parent: any,
	args: { name: string },
	context: ResolverContext
): Promise<Publisher> {
	const user = context.user

	// Check if the user is logged in
	if (user == null) {
		throwApiError(apiErrors.notAuthenticated)
	}

	let isAdmin = admins.includes(user.id)
	let publisher: Publisher = null

	if (!isAdmin) {
		// Check if the user is already a publisher
		publisher = await context.prisma.publisher.findFirst({
			where: { userId: user.id }
		})

		if (publisher != null) {
			throwApiError(apiErrors.actionNotAllowed)
		}
	}

	// Validate the args
	throwValidationError(validateNameLength(args.name))

	// Create the publisher
	return await context.prisma.publisher.create({
		data: {
			uuid: crypto.randomUUID(),
			name: args.name
		}
	})
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

	let publisher: Publisher = null
	const user = context.user

	if (uuid == "mine") {
		// Check if the user is a publisher
		if (user == null) {
			throwApiError(apiErrors.notAuthenticated)
		} else if (admins.includes(user.id)) {
			throwApiError(apiErrors.actionNotAllowed)
		}

		// Get the publisher of the user
		publisher = await context.prisma.publisher.findFirst({
			where: { userId: user.id }
		})
	} else {
		// Check if the user is an admin
		if (user == null) {
			throwApiError(apiErrors.notAuthenticated)
		} else if (!admins.includes(user.id)) {
			throwApiError(apiErrors.actionNotAllowed)
		}

		// Get the publisher
		publisher = await context.prisma.publisher.findFirst({
			where: { uuid }
		})
	}

	if (publisher == null) {
		throwApiError(apiErrors.publisherDoesNotExist)
	}

	if (
		args.name == null &&
		args.description == null &&
		args.websiteUrl == null &&
		args.facebookUsername == null &&
		args.instagramUsername == null &&
		args.twitterUsername == null
	) {
		return publisher
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
		errors.push(validationErrors.facebookUsernameInvalid)
	}

	if (args.instagramUsername != null && instagramUsername == null) {
		errors.push(validationErrors.instagramUsernameInvalid)
	}

	if (args.twitterUsername != null && twitterUsername == null) {
		errors.push(validationErrors.twitterUsernameInvalid)
	}

	throwValidationError(...errors)

	// Update the publisher
	let data = {}

	if (args.name != null) {
		data["name"] = args.name
	}

	if (args.description != null) {
		data["description"] = args.description
	}

	if (args.websiteUrl != null) {
		data["website_url"] = args.websiteUrl
	}

	if (facebookUsername != null) {
		data["facebook_username"] = facebookUsername
	}

	if (instagramUsername != null) {
		data["instagram_username"] = instagramUsername
	}

	if (twitterUsername != null) {
		data["twitter_username"] = twitterUsername
	}

	return await context.prisma.publisher.update({
		where: { id: publisher.id },
		data
	})
}

export async function logo(
	publisher: Publisher,
	args: any,
	context: ResolverContext
): Promise<PublisherLogo> {
	let publisherLogo = await context.prisma.publisherLogo.findFirst({
		where: { publisherId: publisher.id }
	})

	return {
		...publisherLogo,
		url: getTableObjectFileUrl(publisherLogo.uuid)
	}
}

export async function authors(
	publisher: Publisher,
	args: { limit?: number; offset?: number },
	context: ResolverContext
): Promise<List<Author>> {
	let take = args.limit || 10
	if (take <= 0) take = 10

	let skip = args.offset || 0
	if (skip < 0) skip = 0

	let where = { publisherId: publisher.id }

	const [total, items] = await context.prisma.$transaction([
		context.prisma.author.count({ where }),
		context.prisma.author.findMany({
			where,
			take,
			skip
		})
	])

	return {
		total,
		items
	}
}
