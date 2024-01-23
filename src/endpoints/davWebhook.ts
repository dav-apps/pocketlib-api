import { Express, Request, Response, json } from "express"
import cors from "cors"
import { getLastReleaseOfStoreBook, getTableObjectFileUrl } from "../utils.js"
import { retrieveOrder } from "../services/apiService.js"
import { authenticate, createPrintJob } from "../services/luluApiService.js"
import { prisma } from "../../server.js"

const webhookKey = process.env.WEBHOOK_KEY

async function davWebhook(req: Request, res: Response) {
	// Check the authorization header
	if (req.headers["authorization"] != webhookKey) {
		return res.sendStatus(400)
	}

	if (req.body.type == "order.completed") {
		const orderUuid = req.body.uuid

		let order = await retrieveOrder(
			`
				userId
				tableObject {
					uuid
				}
				price
				currency
				shippingAddress {
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
			`,
			{ uuid: orderUuid }
		)
		console.log(order)

		if (order == null) {
			return res.sendStatus(400)
		}

		// Get the StoreBook
		const storeBook = await prisma.storeBook.findFirst({
			where: { uuid: order.tableObject.uuid }
		})

		if (storeBook == null) {
			return res.sendStatus(400)
		}

		const storeBookRelease = await getLastReleaseOfStoreBook(
			prisma,
			storeBook.id,
			BigInt(order.userId) != storeBook.userId
		)

		if (storeBookRelease == null) {
			return res.sendStatus(400)
		}

		const printCover = await prisma.storeBookPrintCover.findFirst({
			where: { id: storeBookRelease.printCoverId }
		})

		const printFile = await prisma.storeBookPrintFile.findFirst({
			where: { id: storeBookRelease.printFileId }
		})

		const luluAuthenticationResponse = await authenticate()

		if (luluAuthenticationResponse == null) {
			return res.sendStatus(500)
		}

		const luluAccessToken = luluAuthenticationResponse.access_token

		let createPrintJobResponse = await createPrintJob(luluAccessToken, {
			title: storeBookRelease.title,
			printJobExternalId: orderUuid,
			lineItemExternalId: storeBookRelease.uuid,
			coverSourceUrl: getTableObjectFileUrl(printCover.uuid),
			interiorSourceUrl: getTableObjectFileUrl(printFile.uuid),
			shippingAddress: order.shippingAddress
		})

		console.log(createPrintJobResponse)
	}

	res.send()
}

export function setup(app: Express) {
	app.post("/webhooks/dav", json(), cors(), davWebhook)
}
