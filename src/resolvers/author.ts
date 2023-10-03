import {
	Publisher,
	Author,
	AuthorBio,
	StoreBookCollection,
	StoreBookSeries
} from "@prisma/client"
import * as crypto from "crypto"
import { ResolverContext, List, AuthorProfileImage } from "../types.js"
import {
	throwApiError,
	throwValidationError,
	getFacebookUsername,
	getInstagramUsername,
	getTwitterUsername,
	getTableObjectFileUrl,
	randomNumber
} from "../utils.js"
import { apiErrors, validationErrors } from "../errors.js"
import { admins } from "../constants.js"
import {
	validateFirstNameLength,
	validateLastNameLength,
	validateWebsiteUrl
} from "../services/validationService.js"

export async function retrieveAuthor(
	parent: any,
	args: { uuid: string },
	context: ResolverContext
): Promise<Author> {
	const uuid = args.uuid
	if (uuid == null) return null

	let where = {}

	if (uuid == "mine") {
		// Check if the user is an author
		const user = context.user

		if (user == null) {
			throwApiError(apiErrors.notAuthenticated)
		} else if (admins.includes(user.id)) {
			throwApiError(apiErrors.actionNotAllowed)
		}

		// Get the author of the user
		where = { userId: user.id }
	} else {
		where = { uuid }
	}

	return await context.prisma.author.findFirst({ where })
}

export async function listAuthors(
	parent: any,
	args: {
		mine?: boolean
		random?: boolean
		limit?: number
		offset?: number
	},
	context: ResolverContext
): Promise<List<Author>> {
	let take = args.limit || 10
	if (take <= 0) take = 10

	let skip = args.offset || 0
	if (skip < 0) skip = 0

	let mine = args.mine || false
	let random = args.random || false
	let where = {}

	if (mine) {
		// Check if the user is an admin
		const user = context.user

		if (user == null) {
			throwApiError(apiErrors.notAuthenticated)
		} else if (!admins.includes(user.id)) {
			throwApiError(apiErrors.actionNotAllowed)
		}

		// Get the authors of the user
		where = { userId: user.id, publisher: null }
	} else if (random) {
		let total = await context.prisma.author.count()
		if (take > total) take = total

		let indices = []
		let items = []

		while (indices.length < take) {
			let i = randomNumber(0, total - 1)

			if (!indices.includes(i)) {
				indices.push(i)
			}
		}

		for (let i of indices) {
			items.push(await context.prisma.author.findFirst({ skip: i }))
		}

		return {
			total,
			items
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
		total,
		items
	}
}

export async function createAuthor(
	parent: any,
	args: { publisher?: string; firstName: string; lastName: string },
	context: ResolverContext
): Promise<Author> {
	const user = context.user

	// Check if the user is logged in
	if (user == null) {
		throwApiError(apiErrors.notAuthenticated)
	}

	let isAdmin = admins.includes(user.id)
	let publisher: Publisher = null

	if (isAdmin && args.publisher != null) {
		// Get the publisher
		publisher = await context.prisma.publisher.findFirst({
			where: { uuid: args.publisher }
		})

		if (publisher == null) {
			throwApiError(apiErrors.publisherDoesNotExist)
		}
	} else if (!isAdmin) {
		// Check if the user already is an author
		let author = await context.prisma.author.findFirst({
			where: { userId: user.id }
		})

		if (author != null) {
			throwApiError(apiErrors.actionNotAllowed)
		}
	}

	// Validate the args
	throwValidationError(
		validateFirstNameLength(args.firstName),
		validateLastNameLength(args.lastName)
	)

	// Create the author
	let data = {
		uuid: crypto.randomUUID(),
		firstName: args.firstName,
		lastName: args.lastName
	}

	if (isAdmin && publisher != null) {
		data["publisher"] = {
			connect: {
				id: publisher.id
			}
		}
	}

	return await context.prisma.author.create({ data })
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
	context: ResolverContext
): Promise<Author> {
	const uuid = args.uuid
	if (uuid == null) return null

	let facebookUsername = getFacebookUsername(args.facebookUsername)
	let instagramUsername = getInstagramUsername(args.instagramUsername)
	let twitterUsername = getTwitterUsername(args.twitterUsername)

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
	} else {
		// Check if the user is an admin
		if (user == null) {
			throwApiError(apiErrors.notAuthenticated)
		} else if (!admins.includes(user.id)) {
			throwApiError(apiErrors.actionNotAllowed)
		}

		// Get the author
		author = await context.prisma.author.findFirst({
			where: { uuid }
		})
	}

	if (author == null) {
		throwApiError(apiErrors.authorDoesNotExist)
	}

	if (
		args.firstName == null &&
		args.lastName == null &&
		args.websiteUrl == null &&
		args.facebookUsername == null &&
		args.instagramUsername == null &&
		args.twitterUsername == null
	) {
		return author
	}

	// Validate the args
	let errors: string[] = []

	if (args.firstName != null) {
		errors.push(validateFirstNameLength(args.firstName))
	}

	if (args.lastName != null) {
		errors.push(validateLastNameLength(args.lastName))
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

	// Update the author
	let data = {}

	if (args.firstName != null) {
		data["firstName"] = args.firstName
	}

	if (args.lastName != null) {
		data["lastName"] = args.lastName
	}

	if (args.websiteUrl != null) {
		data["websiteUrl"] = args.websiteUrl
	}

	if (facebookUsername != null) {
		data["facebookUsername"] = facebookUsername
	}

	if (instagramUsername != null) {
		data["instagramUsername"] = instagramUsername
	}

	if (twitterUsername != null) {
		data["twitterUsername"] = twitterUsername
	}

	return await context.prisma.author.update({
		where: { id: author.id },
		data
	})
}

export async function publisher(
	author: Author,
	args: any,
	context: ResolverContext
): Promise<Publisher> {
	if (author.publisherId == null) {
		return null
	}

	return await context.prisma.publisher.findFirst({
		where: { id: author.publisherId }
	})
}

export async function bio(
	author: Author,
	args: { languages?: String[] },
	context: ResolverContext,
	info: any
): Promise<AuthorBio> {
	let languages = args.languages || ["en"]
	let where = { OR: [], AND: { authorId: author.id } }

	for (let lang of languages) {
		where.OR.push({ language: lang })
	}

	let bios = await context.prisma.authorBio.findMany({ where })

	if (bios.length == 0) {
		return null
	}

	// Find the optimal bio for the given languages
	for (let lang of languages) {
		let bio = bios.find(b => b.language == lang)

		if (bio != null) {
			return bio
		}
	}

	return bios[0]
}

export async function bios(
	author: Author,
	args: { limit?: number; offset?: number },
	context: ResolverContext
): Promise<List<AuthorBio>> {
	let take = args.limit || 10
	if (take <= 0) take = 10

	let skip = args.offset || 0
	if (skip < 0) skip = 0

	let where = { authorId: author.id }

	const [total, items] = await context.prisma.$transaction([
		context.prisma.authorBio.count({ where }),
		context.prisma.authorBio.findMany({
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

export async function profileImage(
	author: Author,
	args: any,
	context: ResolverContext
): Promise<AuthorProfileImage> {
	let profileImage = await context.prisma.authorProfileImage.findFirst({
		where: { authorId: author.id }
	})

	return {
		...profileImage,
		url: getTableObjectFileUrl(profileImage.uuid)
	}
}

export async function collections(
	author: Author,
	args: { limit?: number; offset?: number },
	context: ResolverContext
): Promise<List<StoreBookCollection>> {
	let take = args.limit || 10
	if (take <= 0) take = 10

	let skip = args.offset || 0
	if (skip < 0) skip = 0

	let where = { authorId: author.id }

	const [total, items] = await context.prisma.$transaction([
		context.prisma.storeBookCollection.count({ where }),
		context.prisma.storeBookCollection.findMany({
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

export async function series(
	author: Author,
	args: { limit?: number; offset?: number },
	context: ResolverContext
): Promise<List<StoreBookSeries>> {
	let take = args.limit || 10
	if (take <= 0) take = 10

	let skip = args.offset || 0
	if (skip < 0) skip = 0

	let where = { authorId: author.id }

	const [total, items] = await context.prisma.$transaction([
		context.prisma.storeBookSeries.count({ where }),
		context.prisma.storeBookSeries.findMany({
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
