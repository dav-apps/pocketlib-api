import {
	TableObjectResource,
	TableObjectsController,
	CheckoutSessionsController,
	ShippingAddressesController,
	Plan,
	TableObjectPriceType,
	Auth,
	ShippingAddressResource
} from "dav-js"
import { ResolverContext, List, StoreBook } from "../types.js"
import {
	throwApiError,
	getLastReleaseOfStoreBook,
	getTableObjectFileCdnUrl,
	downloadFile
} from "../utils.js"
import { apiErrors } from "../errors.js"
import { vlbItemTableId } from "../constants.js"
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

	if (
		storeBookRelease == null ||
		(!userIsAuthor && storeBookRelease.status !== "published")
	) {
		throwApiError(apiErrors.storeBookReleaseDoesNotExist)
	}
	if (storeBookRelease.coverId == null)
		throwApiError(apiErrors.unexpectedError)

	let cover = await context.prisma.storeBookCover.findFirst({
		where: { id: storeBookRelease.coverId }
	})

	if (cover == null) throwApiError(apiErrors.unexpectedError)

	let price = null

	if (userIsAuthor) {
		if (storeBookRelease.printFileId == null)
			throwApiError(apiErrors.unexpectedError)
		let printFile = await context.prisma.storeBookPrintFile.findFirst({
			where: { id: storeBookRelease.printFileId }
		})

		if (printFile == null) throwApiError(apiErrors.unexpectedError)

		const auth = new Auth({
			apiKey: process.env.DAV_API_KEY,
			secretKey: process.env.DAV_SECRET_KEY,
			uuid: process.env.DAV_UUID
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

		let listShippingAddressesResponse =
			await ShippingAddressesController.listShippingAddresses(
				listShippingAddressesQueryData,
				{
					auth,
					userId: user.Id,
					limit: 1
				}
			)

		if (
			listShippingAddressesResponse == null ||
			Array.isArray(listShippingAddressesResponse) ||
			listShippingAddressesResponse.items.length === 0
		) {
			// Get the shipping address of the first user
			listShippingAddressesResponse =
				await ShippingAddressesController.listShippingAddresses(
					listShippingAddressesQueryData,
					{ auth, userId: 1, limit: 1 }
				)

			if (
				listShippingAddressesResponse == null ||
				Array.isArray(listShippingAddressesResponse) ||
				listShippingAddressesResponse.items.length === 0
			) {
				throwApiError(apiErrors.unexpectedError)
			}
		}

		const shippingAddresses = (
			listShippingAddressesResponse as List<ShippingAddressResource>
		).items

		// Get the cost for printing the book & charge that instead of the given price
		let luluAuthenticationResponse = await authenticate()

		if (!luluAuthenticationResponse?.access_token)
			throwApiError(apiErrors.unexpectedError)

		const costCalculationResponse = await createPrintJobCostCalculation(
			luluAuthenticationResponse.access_token,
			{
				pageCount: printFile.pages,
				shippingAddress: shippingAddresses[0]
			}
		)

		if (costCalculationResponse == null) {
			throwApiError(apiErrors.unexpectedError)
		}

		price = toCents(costCalculationResponse.total_cost_incl_tax)
	}

	let createCheckoutSessionResponse =
		await CheckoutSessionsController.createPaymentCheckoutSession(`url`, {
			accessToken,
			tableObjectUuid: storeBook.uuid,
			type: TableObjectPriceType.Order,
			price,
			currency: "EUR",
			productName: storeBookRelease.title,
			productImage: getTableObjectFileCdnUrl(cover.uuid),
			successUrl: args.successUrl,
			cancelUrl: args.cancelUrl
		})

	if (
		createCheckoutSessionResponse == null ||
		Array.isArray(createCheckoutSessionResponse) ||
		!createCheckoutSessionResponse.url
	) {
		throwApiError(apiErrors.unexpectedError)
	} else {
		return { url: createCheckoutSessionResponse.url }
	}
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

	let title = result.titles?.find(t => t.titleType == "01")
	let price = result.prices?.find(
		p =>
			(p.priceType == "02" || p.priceType == "04") &&
			p.countriesIncluded == "DE"
	)

	if (!title?.title || price == null) throwApiError(apiErrors.unexpectedError)
	const priceInCents = toCents(price.priceAmount)

	// Check if the cover was already uploaded
	const coverKey = `vlb-covers/${vlbItem.mvbId}.jpg`
	let coverLink = getFileLink(coverKey)

	if (!(await check(coverKey))) {
		// Get the cover
		let cover = result.supportingResources?.find(
			r => r.resourceContentType == "01"
		)

		if (cover?.exportedLink != null) {
			// Download the cover & upload it on DO
			let link = `${cover.exportedLink}?access_token=${process.env.VLB_COVER_TOKEN}`
			let coverData = await downloadFile(link)

			if ((await upload(coverKey, coverData, "image/jpeg")) == null) {
				throwApiError(apiErrors.unexpectedError)
			}
		}
	}

	// Check if the table object of the VlbItem already exists
	let tableObject: TableObjectResource = null
	let retrieveTableObjectResponse =
		await TableObjectsController.retrieveTableObject(`uuid`, {
			accessToken,
			uuid: vlbItem.uuid
		})

	if (
		retrieveTableObjectResponse == null ||
		Array.isArray(retrieveTableObjectResponse)
	) {
		// Create the table object
		let createTableObjectResponse =
			await TableObjectsController.createTableObject(`uuid`, {
				accessToken,
				uuid: vlbItem.uuid,
				tableId: vlbItemTableId
			})

		if (!Array.isArray(createTableObjectResponse)) {
			tableObject = createTableObjectResponse
		}
	} else {
		tableObject = retrieveTableObjectResponse
	}

	if (tableObject == null) {
		throwApiError(apiErrors.unexpectedError)
	}

	let shippingRate = null

	if (user.Plan != Plan.Pro) {
		// Add shipping rate
		shippingRate = {
			name: "Standard-Versand",
			price: 450
		}
	}

	let createCheckoutSessionResponse =
		await CheckoutSessionsController.createPaymentCheckoutSession(`url`, {
			accessToken,
			tableObjectUuid: vlbItem.uuid,
			type: TableObjectPriceType.Order,
			price: priceInCents,
			currency: "EUR",
			productName: title.title,
			productImage: coverLink,
			shippingRate,
			successUrl: args.successUrl,
			cancelUrl: args.cancelUrl
		})

	if (
		createCheckoutSessionResponse == null ||
		Array.isArray(createCheckoutSessionResponse) ||
		!createCheckoutSessionResponse.url
	) {
		throwApiError(apiErrors.unexpectedError)
	} else {
		return { url: createCheckoutSessionResponse.url }
	}
}

function toCents(amount: number | string): number {
	if (amount == null || (typeof amount === "string" && amount.trim() === "")) {
		throwApiError(apiErrors.unexpectedError)
	}
	const value = Number(amount)
	const cents = Math.round(value * 100)
	if (!Number.isFinite(value) || value < 0 || !Number.isSafeInteger(cents)) {
		throwApiError(apiErrors.unexpectedError)
	}
	return cents
}
