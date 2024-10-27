import { ResolverContext, StoreBook } from "../types.js"
import {
	throwApiError,
	getLastReleaseOfStoreBook,
	getTableObjectFileCdnUrl
} from "../utils.js"
import { apiErrors } from "../errors.js"
import { vlbItemOrderTableId } from "../constants.js"
import * as apiService from "../services/apiService.js"
import {
	authenticate,
	createPrintJobCostCalculation
} from "../services/luluApiService.js"
import { getProduct } from "../services/vlbApiService.js"

export async function createCheckoutSessionForStoreBook(
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

	let cover = await context.prisma.storeBookCover.findFirst({
		where: { id: storeBookRelease.coverId }
	})

	let price = null

	if (userIsAuthor) {
		let printFile = await context.prisma.storeBookPrintFile.findFirst({
			where: { id: storeBookRelease.printFileId }
		})

		const listShippingAddressesQueryData = `
			total
			items {
				name
				email
				phone
				city
				country
				line1
				line2
				postalCode
				state
			}
		`

		let shippingAddresses = await apiService.listShippingAddresses(
			listShippingAddressesQueryData,
			{ userId: user.id, limit: 1 }
		)

		if (shippingAddresses.total == 0) {
			// Get the shipping address of the first user
			shippingAddresses = await apiService.listShippingAddresses(
				listShippingAddressesQueryData,
				{ userId: 1, limit: 1 }
			)
		}

		// Get the cost for printing the book & charge that instead of the given price
		let luluAuthenticationResponse = await authenticate()

		const costCalculationResponse = await createPrintJobCostCalculation(
			luluAuthenticationResponse.access_token,
			{
				pageCount: printFile.pages,
				shippingAddress: shippingAddresses.items[0]
			}
		)

		if (costCalculationResponse == null) {
			throwApiError(apiErrors.unexpectedError)
		}

		price = Number(costCalculationResponse.total_cost_incl_tax) * 100
	}

	let createCheckoutSessionResponse =
		await apiService.createPaymentCheckoutSession(`url`, accessToken, {
			tableObjectUuid: storeBook.uuid,
			type: "ORDER",
			price,
			currency: "EUR",
			productName: storeBookRelease.title,
			productImage: getTableObjectFileCdnUrl(cover.uuid),
			successUrl: args.successUrl,
			cancelUrl: args.cancelUrl
		})

	return { url: createCheckoutSessionResponse }
}

export async function createCheckoutSessionForVlbItem(
	parent: any,
	args: { productId: string; successUrl: string; cancelUrl: string },
	context: ResolverContext
): Promise<{ url: string }> {
	const user = context.user
	const accessToken = context.accessToken

	// Check if the user is logged in
	if (user == null) {
		throwApiError(apiErrors.notAuthenticated)
	}

	// Get the VlbItem
	let result = await getProduct(args.productId)

	if (result == null) {
		throwApiError(apiErrors.vlbItemDoesNotExist)
	}

	// Create the table object
	let orderTableObject = await apiService.createTableObject(
		crypto.randomUUID(),
		vlbItemOrderTableId
	)

	let title = result.titles.find(t => t.titleType == "01")
	let price = result.prices.find(
		p =>
			(p.priceType == "02" || p.priceType == "04") &&
			p.countriesIncluded == "DE"
	)
	let cover = result.supportingResources.find(
		r => r.resourceContentType == "01"
	)

	let createCheckoutSessionResponse =
		await apiService.createPaymentCheckoutSession(`url`, accessToken, {
			tableObjectUuid: orderTableObject.uuid,
			type: "ORDER",
			price: price.priceAmount * 100,
			currency: "EUR",
			productName: title.title,
			productImage: cover.exportedLink
				? `${cover.exportedLink}?access_token=${process.env.VLB_COVER_TOKEN}`
				: null,
			successUrl: args.successUrl,
			cancelUrl: args.cancelUrl
		})

	return { url: createCheckoutSessionResponse }
}
