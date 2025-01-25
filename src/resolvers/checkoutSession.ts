import { TableObject, TableObjectsController, Plan } from "dav-js"
import { ResolverContext, StoreBook } from "../types.js"
import {
	throwApiError,
	getLastReleaseOfStoreBook,
	getTableObjectFileCdnUrl,
	downloadFile
} from "../utils.js"
import { apiErrors } from "../errors.js"
import { vlbItemTableId } from "../constants.js"
import * as apiService from "../services/apiService.js"
import {
	authenticate,
	createPrintJobCostCalculation
} from "../services/luluApiService.js"
import { getProduct } from "../services/vlbApiService.js"
import { check, upload, getFileLink } from "../services/fileService.js"

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

	const userIsAuthor = storeBook.userId == BigInt(user.Id)

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
			{ userId: user.Id, limit: 1 }
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
	args: { uuid: string; successUrl: string; cancelUrl: string },
	context: ResolverContext
): Promise<{ url: string }> {
	const user = context.user
	const accessToken = context.accessToken

	// Check if the user is logged in
	if (user == null) {
		throwApiError(apiErrors.notAuthenticated)
	}

	// Get the VlbItem from the database
	let vlbItem = await context.prisma.vlbItem.findFirst({
		where: { uuid: args.uuid }
	})

	if (vlbItem == null) {
		throwApiError(apiErrors.vlbItemDoesNotExist)
	}

	// Get the VlbItem
	let result = await getProduct(vlbItem.mvbId)

	if (result == null) {
		throwApiError(apiErrors.vlbItemDoesNotExist)
	}

	// Check if the cover was already uploaded
	const coverKey = `vlb-covers/${vlbItem.mvbId}.jpg`
	let coverLink = getFileLink(coverKey)

	if (!(await check(coverKey))) {
		// Get the cover
		let cover = result.supportingResources.find(
			r => r.resourceContentType == "01"
		)

		if (cover?.exportedLink != null) {
			// Download the cover & upload it on DO
			let link = `${cover.exportedLink}?access_token=${process.env.VLB_COVER_TOKEN}`
			let coverData = await downloadFile(link)

			await upload(coverKey, coverData, "image/jpeg")
		}
	}

	// Check if the table object of the VlbItem already exists
	let tableObject: TableObject = null
	let retrieveTableObjectResponse =
		await TableObjectsController.retrieveTableObject(`uuid`, {
			uuid: vlbItem.uuid
		})

	if (
		!Array.isArray(retrieveTableObjectResponse) &&
		retrieveTableObjectResponse == null
	) {
		// Create the table object
		let createTableObjectResponse =
			await TableObjectsController.createTableObject(`uuid`, {
				uuid: vlbItem.uuid,
				tableId: vlbItemTableId
			})

		if (!Array.isArray(createTableObjectResponse)) {
			tableObject = createTableObjectResponse
		}
	}

	if (tableObject == null) {
		throwApiError(apiErrors.unexpectedError)
	}

	let title = result.titles.find(t => t.titleType == "01")
	let price = result.prices.find(
		p =>
			(p.priceType == "02" || p.priceType == "04") &&
			p.countriesIncluded == "DE"
	)

	let shippingRate = null

	if (user.Plan != Plan.Pro) {
		// Add shipping rate
		shippingRate = {
			name: "Standard-Versand",
			price: 250
		}
	}

	let createCheckoutSessionResponse =
		await apiService.createPaymentCheckoutSession(`url`, accessToken, {
			tableObjectUuid: vlbItem.uuid,
			type: "ORDER",
			price: Math.round(price.priceAmount * 100),
			currency: "EUR",
			productName: title.title,
			productImage: coverLink,
			shippingRate,
			successUrl: args.successUrl,
			cancelUrl: args.cancelUrl
		})

	return { url: createCheckoutSessionResponse }
}
