import { Prisma, Publisher, Author } from "@prisma/client"
import * as crypto from "crypto"
import validator from "validator"
import { ResolverContext, QueryResult, List, PublisherLogo } from "../types.js"
import {
	throwApiError,
	throwValidationError,
	getFacebookUsername,
	getInstagramUsername,
	getTwitterUsername,
	getTableObjectFileCdnUrl,
	stringToSlug
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
): Promise<QueryResult<Publisher>> {
	const uuid = args.uuid

	if (uuid == "mine") {
		// Check if the user is a publisher
		const user = context.user

		if (user == null) {
			throwApiError(apiErrors.notAuthenticated)
		} else if (admins.includes(user.Id)) {
			throwApiError(apiErrors.actionNotAllowed)
		}

		// Get the publisher of the user
		return {
			caching: false,
			data: await context.prisma.publisher.findFirst({
				where: { userId: user.Id }
			})
		}
	}

	let where: any = { uuid }

	if (!validator.isUUID(uuid)) {
		where = { slug: uuid }
	}

	return {
		caching: true,
		data: await context.prisma.publisher.findFirst({ where })
	}
}

export async function listPublishers(
	parent: any,
	args: { limit?: number; offset?: number },
	context: ResolverContext
): Promise<QueryResult<List<Publisher>>> {
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
		caching: true,
		data: {
			total,
			items
		}
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

	let isAdmin = admins.includes(user.Id)
	let publisher: Publisher = null

	if (!isAdmin) {
		// Check if the user is already a publisher
		publisher = await context.prisma.publisher.findFirst({
			where: { userId: user.Id }
		})

		if (publisher != null) {
			throwApiError(apiErrors.actionNotAllowed)
		}
	}

	// Validate the args
	throwValidationError(validateNameLength(args.name))

	// Create the publisher
	let uuid = crypto.randomUUID()
	let name = args.name

	return await context.prisma.publisher.create({
		data: {
			uuid,
			userId: user.Id,
			slug: stringToSlug(`${name} ${uuid}`),
			name
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

	let facebookUsernameResult = getFacebookUsername(args.facebookUsername)
	let instagramUsernameResult = getInstagramUsername(args.instagramUsername)
	let twitterUsernameResult = getTwitterUsername(args.twitterUsername)

	let publisher: Publisher = null
	const user = context.user

	if (uuid == "mine") {
		// Check if the user is a publisher
		if (user == null) {
			throwApiError(apiErrors.notAuthenticated)
		} else if (admins.includes(user.Id)) {
			throwApiError(apiErrors.actionNotAllowed)
		}

		// Get the publisher of the user
		publisher = await context.prisma.publisher.findFirst({
			where: { userId: user.Id }
		})
	} else {
		// Check if the user is an admin
		if (user == null) {
			throwApiError(apiErrors.notAuthenticated)
		} else if (!admins.includes(user.Id)) {
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

	if (!facebookUsernameResult.valid) {
		errors.push(validationErrors.facebookUsernameInvalid)
	}

	if (!instagramUsernameResult.valid) {
		errors.push(validationErrors.instagramUsernameInvalid)
	}

	if (!twitterUsernameResult.valid) {
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
		data["websiteUrl"] = args.websiteUrl
	}

	if (args.facebookUsername != null) {
		data["facebookUsername"] = facebookUsernameResult.value
	}

	if (args.instagramUsername != null) {
		data["instagramUsername"] = instagramUsernameResult.value
	}

	if (args.twitterUsername != null) {
		data["twitterUsername"] = twitterUsernameResult.value
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
): Promise<QueryResult<PublisherLogo>> {
	let publisherLogo = await context.prisma.publisherLogo.findFirst({
		where: { publisherId: publisher.id }
	})

	if (publisherLogo == null) {
		return {
			caching: true,
			data: null
		}
	}

	return {
		caching: true,
		data: {
			...publisherLogo,
			url: getTableObjectFileCdnUrl(publisherLogo.uuid)
		}
	}
}

export async function authors(
	publisher: Publisher,
	args: { limit?: number; offset?: number; query?: string },
	context: ResolverContext
): Promise<QueryResult<List<Author>>> {
	let take = args.limit || 10
	if (take <= 0) take = 10

	let skip = args.offset || 0
	if (skip < 0) skip = 0

	let query = args.query?.toLowerCase() ?? ""
	let where: any = { publisherId: publisher.id }

	if (args.query != null && args.query.length > 0) {
		where = {
			AND: [
				{ publisherId: publisher.id },
				{
					OR: [
						{
							firstName: {
								contains: query,
								mode: Prisma.QueryMode.insensitive
							}
						},
						{
							lastName: {
								contains: query,
								mode: Prisma.QueryMode.insensitive
							}
						}
					]
				}
			]
		}
	}

	const [total, items] = await context.prisma.$transaction([
		context.prisma.author.count({ where }),
		context.prisma.author.findMany({
			where,
			take,
			skip
		})
	])

	return {
		caching: true,
		data: {
			total,
			items
		}
	}
}
