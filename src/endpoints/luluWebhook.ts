import { Express, Request, Response, json } from "express"
import cors from "cors"
import { OrderStatus } from "../types.js"
import { retrieveOrder, updateOrder } from "../services/apiService.js"
import { prisma } from "../../server.js"

async function luluWebhook(req: Request, res: Response) {
	const externalId = req.body.data.external_id
	const status = req.body.data.status.name
	const lineItems = req.body.data.line_items

	// Get the order
	let order = await retrieveOrder(
		`
			uuid
			status
		`,
		{ uuid: externalId }
	)

	// Update the order status
	let newOrderStatus: OrderStatus =
		status == "SHIPPED" ? "SHIPPED" : "PREPARATION"

	if (newOrderStatus != order.status) {
		order = await updateOrder(`uuid`, {
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
