import { expect, it } from "vitest"
import { Resend } from "resend"
import nock from "nock"

it("passes the webhook idempotency key to the Resend HTTP API", async () => {
	const scope = nock("https://api.resend.com", {
		reqheaders: {
			"idempotency-key": "dav/order.completed/test-order/customer"
		}
	})
		.post("/emails", {
			from: "sender@example.test",
			to: "reader@example.test",
			subject: "Order",
			html: "<p>Confirmed</p>"
		})
		.reply(200, { id: "email-id" })
	const result = await new Resend("re_test_key").emails.send(
		{
			from: "sender@example.test",
			to: "reader@example.test",
			subject: "Order",
			html: "<p>Confirmed</p>"
		},
		{ idempotencyKey: "dav/order.completed/test-order/customer" }
	)
	expect(result.error).toBeNull()
	expect(result.data?.id).toBe("email-id")
	expect(scope.isDone()).toBe(true)
})
