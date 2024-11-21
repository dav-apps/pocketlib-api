import { Express, Request, Response, json } from "express"
import cors from "cors"
import Stripe from "stripe"
import { prisma, stripe, resend } from "../../server.js"
import { retrieveOrder } from "../services/apiService.js"
import OrderEmail from "../emails/order.js"
import OrderConfirmationEmail from "../emails/orderConfirmation.js"
import { getVlbItemCoverUrl } from "../utils.js"
import { noReplyEmailAddress } from "../constants.js"

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
			{ uuid: orderUuid }
		)

		if (order == null) {
			return res.sendStatus(404)
		}

		// Get the VlbItem from the database
		let vlbItem = await prisma.vlbItem.findFirst({
			where: { uuid: order.tableObject.uuid }
		})

		if (vlbItem == null) {
			return res.sendStatus(404)
		}

		// Send order email to admin
		resend.emails.send({
			from: noReplyEmailAddress,
			to: "temp1@dav-apps.tech",
			subject: `New order received - ${vlbItem.title}`,
			react: <OrderEmail order={order} vlbItem={vlbItem} />
		})

		// Send order confirmation email to user
		let name = order.shippingAddress.name?.split(" ")[0]
		let product = {
			title: vlbItem.title,
			price: `${(order.price / 100).toFixed(2)} €`,
			coverUrl: getVlbItemCoverUrl(vlbItem.mvbId)
		}

		// Get the invoice link of the payment intent
		let paymentIntent = await stripe.paymentIntents.retrieve(
			order.paymentIntentId,
			{ expand: ["invoice"] }
		)
		let invoiceUrl: string = null

		if (paymentIntent != null) {
			invoiceUrl = (paymentIntent.invoice as Stripe.Invoice)
				?.hosted_invoice_url
		}

		resend.emails.send({
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
		})
	}

	res.send()
}

export function setup(app: Express) {
	app.post("/webhooks/dav", json(), cors(), davWebhook)
}
