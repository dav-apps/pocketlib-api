import { expect, it } from "vitest"
import { createElement } from "react"
import { Resend } from "resend"
import nock from "nock"
import OrderConfirmation from "../../src/emails/orderConfirmation.js"
import OrderSent from "../../src/emails/orderSent.js"
import Order from "../../src/emails/order.js"

const product = {
	title: "Testbuch & mehr",
	price: "12,34 €",
	coverUrl: "https://example.test/cover.png"
}

it.each([
	{
		name: "order confirmation",
		email: createElement(OrderConfirmation, {
			name: "Leserin",
			invoiceUrl: "https://example.test/invoice",
			product
		}),
		content: ["Hi Leserin", "Testbuch &amp; mehr", "12,34", "Rechnung öffnen"],
		link: "https://example.test/invoice"
	},
	{
		name: "shipping notification",
		email: createElement(OrderSent, {
			name: "Leserin",
			product: { ...product, dhlTrackingCode: "123456789" }
		}),
		content: ["Hi Leserin", "Testbuch &amp; mehr", "DHL Sendungsverfolgung"],
		link: "https://www.dhl.de/de/privatkunden/pakete-empfangen/verfolgen.html?piececode=123456789"
	},
	{
		name: "internal order preview",
		email: createElement(Order, { order: null, vlbItem: null }),
		content: ["Order UUID:", "Shipping address"],
		link: null
	}
])("renders $name through the Resend SDK", async ({ email, content, link }) => {
	let html = ""
	const scope = nock("https://api.resend.com")
		.post("/emails", body => {
			html = body.html
			return true
		})
		.reply(200, { id: "email-id" })
	const result = await new Resend("re_test_key").emails.send({
		from: "sender@example.test",
		to: "reader@example.test",
		subject: "Order",
		react: email
	})
	expect(result.error).toBeNull()
	expect(result.data?.id).toBe("email-id")
	expect(scope.isDone()).toBe(true)
	expect(html).toContain("<html")
	const markup = html.replace(/<!--.*?-->/gs, "")
	for (const text of content) expect(markup).toContain(text)
	if (link) expect(html).toContain(`href="${link}"`)
})
