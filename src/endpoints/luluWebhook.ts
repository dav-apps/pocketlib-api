import { Express, Request, Response, json } from "express"
import cors from "cors"
import { Auth, OrdersController, OrderResource } from "dav-js"
import { OrderStatus } from "../types.js"
import { prisma } from "../../server.js"

async function luluWebhook(req: Request, res: Response) {
	const externalId = req.body.data.external_id
	const status = req.body.data.status.name
	const lineItems = req.body.data.line_items

	const auth = new Auth({
		apiKey: process.env.DAV_API_KEY,
		secretKey: process.env.DAV_SECRET_KEY,
		uuid: process.env.DAV_UUID
	})

	// Get the order
	let retrieveOrderResponse = await OrdersController.retrieveOrder(
		`
			uuid
			status
		`,
		{
			auth,
			uuid: externalId
		}
	)

	if (Array.isArray(retrieveOrderResponse)) {
		res.status(400).send()
		return
	}

	const order = retrieveOrderResponse as OrderResource

	// Update the order status
	let newOrderStatus: OrderStatus =
		status == "SHIPPED" ? "SHIPPED" : "PREPARATION"

	if (newOrderStatus != order.status) {
		await OrdersController.updateOrder(`uuid`, {
			auth,
			uuid: order.uuid,
			status: newOrderStatus
		})
	}

	for (let lineItem of lineItems) {
		if (!lineItem.is_reprint) {
			const lineItemExternalId = lineItem.external_id
			const printableId = lineItem.printable_id

			// Get the StoreBookRelease
			const storeBookRelease = await prisma.storeBookRelease.findFirst({
				where: { uuid: lineItemExternalId }
			})

			if (storeBookRelease == null || printableId == null) {
				continue
			}

			// Update the StoreBookRelease with the printable id
			await prisma.storeBookRelease.update({
				where: { id: storeBookRelease.id },
				data: { luluPrintableId: printableId }
			})
		}
	}

	res.send()
}

export function setup(app: Express) {
	app.post("/webhooks/lulu", json(), cors(), luluWebhook)
}
