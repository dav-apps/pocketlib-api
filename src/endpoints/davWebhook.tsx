import { Express, Request, Response, json } from "express"
import cors from "cors"
import { getInvoiceUrl } from "../services/stripeService.js"
import { runWebhookEffectOnce } from "../services/webhookService.js"
import { Auth, OrdersController, OrderResource } from "dav-js"
import type { AppDependencies } from "../appDependencies.js"
import OrderEmail from "../emails/order.js"
import OrderConfirmationEmail from "../emails/orderConfirmation.js"
import { getVlbItemCoverUrl } from "../utils.js"
import { noReplyEmailAddress } from "../constants.js"

async function davWebhook(
	req: Request,
	res: Response,
	{
		prisma,
		stripe,
		resend,
		webhookKey
	}: Pick<AppDependencies, "prisma" | "stripe" | "resend" | "webhookKey">
) {
	// Check the authorization header
	if (!webhookKey || req.headers["authorization"] != webhookKey) {
		return res.sendStatus(400)
	}

	if (typeof req.body?.type !== "string") return res.sendStatus(400)
	if (req.body.type == "order.completed") {
		if (
			typeof req.body.uuid !== "string" ||
			req.body.uuid.length === 0 ||
			req.body.uuid.length > 128
		)
			return res.sendStatus(400)
		const orderUuid = req.body.uuid

		let retrieveOrderResponse = await OrdersController.retrieveOrder(
			`
				uuid
				paymentIntentId
				user {
					id
					email
				}
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
			{
				auth: new Auth({
					apiKey: process.env.DAV_API_KEY,
					secretKey: process.env.DAV_SECRET_KEY,
					uuid: process.env.DAV_UUID
				}),
				uuid: orderUuid
			}
		)

		if (
			retrieveOrderResponse == null ||
			Array.isArray(retrieveOrderResponse)
		) {
			return res.sendStatus(502)
		}

		const order = retrieveOrderResponse as OrderResource

		if (
			!order.tableObject?.uuid ||
			!order.user?.email ||
			!order.shippingAddress ||
			!order.paymentIntentId
		)
			return res.sendStatus(502)

		// Get the VlbItem from the database
		let vlbItem = await prisma.vlbItem.findFirst({
			where: { uuid: order.tableObject.uuid }
		})

		if (vlbItem == null) {
			return res.sendStatus(404)
		}

		// Send order confirmation email to user
		let name = order.shippingAddress.name?.split(" ")[0]
		let product = {
			title: vlbItem.title,
			price: `${(order.price / 100).toFixed(2)} €`.replace(".", ","),
			coverUrl: getVlbItemCoverUrl(vlbItem.mvbId)
		}

		const invoiceUrl = await getInvoiceUrl(stripe, order.paymentIntentId)

		// Send order email to admin
		await runWebhookEffectOnce(
			prisma,
			`dav/order.completed/${orderUuid}/admin`,
			async () => {
				const response = await resend.emails.send(
					{
						from: noReplyEmailAddress,
						to: "temp1@dav-apps.tech",
						subject: `New order received - ${vlbItem.title}`,
						react: <OrderEmail order={order} vlbItem={vlbItem} />
					},
					{ idempotencyKey: `dav/order.completed/${orderUuid}/admin` }
				)
				if (response.error || !response.data)
					throw new Error("Order email delivery failed")
			}
		)

		await runWebhookEffectOnce(
			prisma,
			`dav/order.completed/${orderUuid}/customer`,
			async () => {
				const response = await resend.emails.send(
					{
						from: noReplyEmailAddress,
						to: order.user.email,
						subject: "Vielen Dank für deine Bestellung bei PocketLib",
						react: (
							<OrderConfirmationEmail
								name={name}
								invoiceUrl={invoiceUrl}
								product={product}
							/>
						)
					},
					{ idempotencyKey: `dav/order.completed/${orderUuid}/customer` }
				)
				if (response.error || !response.data)
					throw new Error("Order confirmation delivery failed")
			}
		)
	}

	res.send()
}

export function setup(
	app: Express,
	dependencies: Pick<
		AppDependencies,
		"prisma" | "stripe" | "resend" | "webhookKey"
	>
) {
	app.put("/webhooks/dav", json(), cors(), (req, res) =>
		davWebhook(req, res, dependencies).catch(() => res.sendStatus(502))
	)
}
