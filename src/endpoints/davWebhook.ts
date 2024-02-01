import { Express, Request, Response, json } from "express"
import cors from "cors"
import {
	getLastReleaseOfStoreBook,
	getTableObjectFileCdnUrl
} from "../utils.js"
import { retrieveOrder } from "../services/apiService.js"
import {
	authenticate,
	createPrintJob,
	createReprintJob
} from "../services/luluApiService.js"
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

		const userIsAuthor = BigInt(order.userId) == storeBook.userId

		const storeBookRelease = await getLastReleaseOfStoreBook(
			prisma,
			storeBook.id,
			!userIsAuthor
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

		if (!userIsAuthor && storeBookRelease.luluPrintableId != null) {
			// Print the book as a reprint
			await createReprintJob(luluAccessToken, {
				title: storeBookRelease.title,
				printJobExternalId: orderUuid,
				lineItemExternalId: storeBookRelease.uuid,
				printableId: storeBookRelease.luluPrintableId,
				shippingAddress: order.shippingAddress
			})
		} else {
			await createPrintJob(luluAccessToken, {
				title: storeBookRelease.title,
				printJobExternalId: orderUuid,
				lineItemExternalId: storeBookRelease.uuid,
				coverSourceUrl: getTableObjectFileCdnUrl(printCover.uuid),
				interiorSourceUrl: getTableObjectFileCdnUrl(printFile.uuid),
				shippingAddress: order.shippingAddress
			})
		}
	}

	res.send()
}

export function setup(app: Express) {
	app.post("/webhooks/dav", json(), cors(), davWebhook)
}
