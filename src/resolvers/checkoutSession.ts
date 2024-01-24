import { ResolverContext, StoreBook } from "../types.js"
import {
	throwApiError,
	getLastReleaseOfStoreBook,
	getTableObjectFileUrl
} from "../utils.js"
import { apiErrors } from "../errors.js"
import * as apiService from "../services/apiService.js"

export async function createCheckoutSession(
	parent: any,
	args: { storeBookUuid: string; successUrl: string; cancelUrl: string },
	context: ResolverContext
): Promise<{ url: string }> {
	const user = context.user
	const accessToken = context.accessToken

	// Check if the user is logged in
	if (user == null) {
		throwApiError(apiErrors.notAuthenticated)
	}

	// Get the store book
	let storeBook = (await context.prisma.storeBook.findFirst({
		where: { uuid: args.storeBookUuid }
	})) as StoreBook

	if (storeBook == null) {
		throwApiError(apiErrors.storeBookDoesNotExist)
	}

	const userIsAuthor = storeBook.userId == BigInt(user.id)

	// Get the latest release of the store book
	let storeBookRelease = await getLastReleaseOfStoreBook(
		context.prisma,
		storeBook.id,
		!userIsAuthor
	)

	let printCover = await context.prisma.storeBookPrintCover.findFirst({
		where: { id: storeBookRelease.printCoverId }
	})

	let createCheckoutSessionResponse = await apiService.createCheckoutSession({
		accessToken,
		tableObjectUuid: storeBook.uuid,
		type: "ORDER",
		productName: storeBookRelease.title,
		productImage: getTableObjectFileUrl(printCover.uuid),
		successUrl: args.successUrl,
		cancelUrl: args.cancelUrl
	})

	return { url: createCheckoutSessionResponse }
}
