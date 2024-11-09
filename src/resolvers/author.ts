import {
	Publisher,
	Author,
	AuthorBio,
	StoreBookCollection,
	StoreBookSeries
} from "@prisma/client"
import * as crypto from "crypto"
import validator from "validator"
import {
	ResolverContext,
	QueryResult,
	List,
	AuthorProfileImage
} from "../types.js"
import {
	throwApiError,
	throwValidationError,
	getFacebookUsername,
	getInstagramUsername,
	getTwitterUsername,
	getTableObjectFileCdnUrl,
	randomNumber,
	stringToSlug
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
): Promise<QueryResult<Author>> {
	const uuid = args.uuid

	if (uuid == "mine") {
		// Check if the user is an author
		const user = context.user

		if (user == null) {
			throwApiError(apiErrors.notAuthenticated)
		} else if (admins.includes(user.id)) {
			throwApiError(apiErrors.actionNotAllowed)
		}

		// Get the author of the user
		return {
			caching: false,
			data: await context.prisma.author.findFirst({
				where: { userId: user.id }
			})
		}
	}

	let where: any = { uuid }

	if (!validator.isUUID(uuid)) {
		where = { slug: uuid }
	}

	let author = await context.prisma.author.findFirst({ where })

	return {
		caching: author != null,
		data: author
	}
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
): Promise<QueryResult<List<Author>>> {
	let take = args.limit || 10
	if (take <= 0) take = 10

	let skip = args.offset || 0
	if (skip < 0) skip = 0

	let caching = true
	let mine = args.mine || false
	let random = args.random || false
	let where = {}
	let orderBy = {}

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
		caching = false
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
			caching: true,
			data: {
				total,
				items
			}
		}
	} else {
		orderBy = { id: "desc" }
	}

	const [total, items] = await context.prisma.$transaction([
		context.prisma.author.count({ where }),
		context.prisma.author.findMany({
			where,
			orderBy,
			take,
			skip
		})
	])

	return {
		caching,
		data: {
			total,
			items
		}
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
	let uuid = crypto.randomUUID()
	let firstName = args.firstName
	let lastName = args.lastName

	let data = {
		uuid,
		userId: user.id,
		slug: stringToSlug(`${firstName} ${lastName} ${uuid}`),
		firstName,
		lastName
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
	let facebookUsernameResult = getFacebookUsername(args.facebookUsername)
	let instagramUsernameResult = getInstagramUsername(args.instagramUsername)
	let twitterUsernameResult = getTwitterUsername(args.twitterUsername)

	let author: Author = null
	const user = context.user

	if (args.uuid == "mine") {
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
			where: { uuid: args.uuid }
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

	if (args.facebookUsername != null) {
		data["facebookUsername"] = facebookUsernameResult.value
	}

	if (args.instagramUsername != null) {
		data["instagramUsername"] = instagramUsernameResult.value
	}

	if (args.twitterUsername != null) {
		data["twitterUsername"] = twitterUsernameResult.value
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
): Promise<QueryResult<Publisher>> {
	if (author.publisherId == null) {
		return {
			caching: false,
			data: null
		}
	}

	return {
		caching: true,
		data: await context.prisma.publisher.findFirst({
			where: { id: author.publisherId }
		})
	}
}

export async function bio(
	author: Author,
	args: { languages?: String[] },
	context: ResolverContext,
	info: any
): Promise<QueryResult<AuthorBio>> {
	let languages = args.languages || ["en"]
	let where = { OR: [], AND: { authorId: author.id } }

	for (let lang of languages) {
		where.OR.push({ language: lang })
	}

	let bios = await context.prisma.authorBio.findMany({ where })

	if (bios.length == 0) {
		return {
			caching: true,
			data: null
		}
	}

	// Find the optimal bio for the given languages
	for (let lang of languages) {
		let bio = bios.find(b => b.language == lang)

		if (bio != null) {
			return {
				caching: true,
				data: bio
			}
		}
	}

	return {
		caching: true,
		data: bios[0]
	}
}

export async function bios(
	author: Author,
	args: { limit?: number; offset?: number },
	context: ResolverContext
): Promise<QueryResult<List<AuthorBio>>> {
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
		caching: true,
		data: {
			total,
			items
		}
	}
}

export async function profileImage(
	author: Author,
	args: any,
	context: ResolverContext
): Promise<QueryResult<AuthorProfileImage>> {
	let profileImage = await context.prisma.authorProfileImage.findFirst({
		where: { authorId: author.id }
	})

	if (profileImage == null) {
		return {
			caching: true,
			data: null
		}
	}

	return {
		caching: true,
		data: {
			...profileImage,
			url: getTableObjectFileCdnUrl(profileImage.uuid)
		}
	}
}

export async function collections(
	author: Author,
	args: { limit?: number; offset?: number },
	context: ResolverContext
): Promise<QueryResult<List<StoreBookCollection>>> {
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
		caching: true,
		data: {
			total,
			items
		}
	}
}

export async function series(
	author: Author,
	args: { limit?: number; offset?: number },
	context: ResolverContext
): Promise<QueryResult<List<StoreBookSeries>>> {
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
		caching: true,
		data: {
			total,
			items
		}
	}
}
