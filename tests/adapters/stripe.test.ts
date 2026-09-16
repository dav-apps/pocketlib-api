import { expect, it } from "vitest"
import Stripe from "stripe"
import nock from "nock"
import { getInvoiceUrl } from "../../src/services/stripeService.js"

// Nock's simulated TLS socket does not emit the secureConnect event awaited
// by Stripe's Node transport. Keep the SDK and use its fetch transport here.
const stripe = new Stripe("sk_test_example", {
	maxNetworkRetries: 0,
	httpClient: Stripe.createFetchHttpClient()
})

function invoicePayments(data: unknown[]) {
	return nock("https://api.stripe.com", {
		reqheaders: { "stripe-version": "2026-08-26.dahlia" }
	})
		.get("/v1/invoice_payments")
		.query({
			"payment[type]": "payment_intent",
			"payment[payment_intent]": "pi_test",
			"expand[0]": "data.invoice",
			limit: "1"
		})
		.reply(200, { object: "list", data, has_more: false })
}

it.each([undefined, "", " "])(
	"rejects a missing PaymentIntent ID without listing unrelated invoices: %j",
	async paymentIntentId => {
		await expect(getInvoiceUrl(stripe, paymentIntentId)).rejects.toThrow(
			"PaymentIntent ID is required"
		)
	}
)

it("retrieves the hosted invoice URL through invoice payments", async () => {
	const scope = invoicePayments([
		{ invoice: { id: "in_test", hosted_invoice_url: "https://invoice.test/123" } }
	])
	expect(await getInvoiceUrl(stripe, "pi_test")).toBe("https://invoice.test/123")
	expect(scope.isDone()).toBe(true)
})

it.each([
	{ name: "no invoice", data: [] },
	{ name: "deleted invoice", data: [{ invoice: { id: "in_test", deleted: true } }] },
	{ name: "missing URL", data: [{ invoice: { id: "in_test", hosted_invoice_url: null } }] }
])("returns null for $name", async ({ data }) => {
	const scope = invoicePayments(data)
	expect(await getInvoiceUrl(stripe, "pi_test")).toBeNull()
	expect(scope.isDone()).toBe(true)
})

it("retrieves an invoice when Stripe returns only its ID", async () => {
	const payments = invoicePayments([{ invoice: "in_test" }])
	const invoice = nock("https://api.stripe.com")
		.get("/v1/invoices/in_test")
		.reply(200, { id: "in_test", hosted_invoice_url: "https://invoice.test/123" })
	expect(await getInvoiceUrl(stripe, "pi_test")).toBe("https://invoice.test/123")
	expect(payments.isDone()).toBe(true)
	expect(invoice.isDone()).toBe(true)
})

it("propagates Stripe failures so the webhook can be retried", async () => {
	const scope = nock("https://api.stripe.com")
		.get("/v1/invoice_payments")
		.query(true)
		.reply(503, { error: { type: "api_error", message: "Unavailable" } })
	await expect(getInvoiceUrl(stripe, "pi_test")).rejects.toThrow("Unavailable")
	expect(scope.isDone()).toBe(true)
})
