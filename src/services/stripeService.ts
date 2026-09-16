import type Stripe from "stripe"

export async function getInvoiceUrl(stripe: Stripe, paymentIntentId: string) {
	if (typeof paymentIntentId !== "string" || paymentIntentId.trim() === "")
		throw new Error("PaymentIntent ID is required for invoice lookup")

	const payments = await stripe.invoicePayments.list({
		payment: { type: "payment_intent", payment_intent: paymentIntentId },
		expand: ["data.invoice"],
		limit: 1
	})
	let invoice = payments.data[0]?.invoice
	if (typeof invoice === "string")
		invoice = await stripe.invoices.retrieve(invoice)
	if (!invoice || !("hosted_invoice_url" in invoice)) return null
	return invoice.hosted_invoice_url
}
