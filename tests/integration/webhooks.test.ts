import {
	afterAll,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	vi
} from "vitest"
import { createHmac } from "node:crypto"
import { createPrismaClient } from "../../src/prisma.js"
import { OrdersController, type OrderResource } from "dav-js"
import request from "supertest"
import { createApp } from "../../src/app.js"
import { testDependencies } from "../helpers/dependencies.js"
import { clearBooks, seedBook } from "../helpers/books.js"
import { getTestDatabaseUrl } from "../../scripts/test-database.mjs"

vi.mock("dav-js", async importOriginal => {
	const actual = await importOriginal<typeof import("dav-js")>()
	return {
		...actual,
		OrdersController: {
			...actual.OrdersController,
			retrieveOrder: vi.fn(),
			updateOrder: vi.fn()
		}
	}
})
const prisma = createPrismaClient(getTestDatabaseUrl())
const send = vi.fn()
const paymentIntent = vi.fn()
const dependencies = {
	...testDependencies(),
	prisma,
	luluWebhookSecret: "test-lulu-secret",
	resend: { emails: { send } } as unknown as ReturnType<
		typeof testDependencies
	>["resend"],
	stripe: {
		paymentIntents: { retrieve: paymentIntent }
	} as unknown as ReturnType<typeof testDependencies>["stripe"]
}
let apps: Awaited<ReturnType<typeof createApp>>[] = []
let order: OrderResource
const retrieve = vi.mocked(OrdersController.retrieveOrder)
const update = vi.mocked(OrdersController.updateOrder)
beforeAll(async () => {
	apps = [await createApp(dependencies), await createApp(dependencies)]
})
beforeEach(async () => {
	vi.resetAllMocks()
	await clearBooks(prisma)
	await prisma.webhookEffect.deleteMany()
	await prisma.vlbItem.deleteMany()
	await prisma.vlbItem.create({
		data: { uuid: "ordered-item", title: "Ordered book", mvbId: "mvb-id" }
	})
	order = {
		uuid: "order-uuid",
		status: "CREATED",
		user: { email: "buyer@example.test" },
		tableObject: { uuid: "ordered-item" },
		paymentIntentId: "pi_test",
		price: 1999,
		currency: "EUR",
		shippingAddress: { name: "Test Reader" }
	} as OrderResource
	retrieve.mockImplementation(async () => structuredClone(order))
	update.mockImplementation(async (_, args) => {
		order.status = args.status
		return { uuid: order.uuid } as OrderResource
	})
	send.mockResolvedValue({ data: { id: "email-id" }, error: null })
	paymentIntent.mockResolvedValue({
		invoice: { hosted_invoice_url: "https://invoice.example.test" }
	})
})
afterAll(async () => {
	try {
		await Promise.all(apps.map(app => app.server.stop()))
		await clearBooks(prisma)
		await prisma.webhookEffect.deleteMany()
		await prisma.vlbItem.deleteMany()
	} finally {
		await prisma.$disconnect()
	}
})
function dav(
	index = 0,
	payload: object = { type: "order.completed", uuid: "order-uuid" }
) {
	return request(apps[index].app)
		.post("/webhooks/dav")
		.set("Authorization", "test-webhook-key")
		.send(payload)
}
function luluPayload(status = "SHIPPED", items: unknown[] = []) {
	return {
		topic: "PRINT_JOB_STATUS_CHANGED",
		data: {
			external_id: "order-uuid",
			status: { name: status },
			line_items: items
		}
	}
}
function lulu(
	payload: unknown = luluPayload(),
	index = 0,
	secret = "test-lulu-secret"
) {
	const body = JSON.stringify(payload)
	return request(apps[index].app)
		.post("/webhooks/lulu")
		.set("Content-Type", "application/json")
		.set(
			"Lulu-HMAC-SHA256",
			createHmac("sha256", secret).update(body).digest("hex")
		)
		.send(body)
}

describe("DAV order webhook", () => {
	it("rejects absent credentials before external calls", async () => {
		const result = await request(apps[0].app)
			.post("/webhooks/dav")
			.send({ type: "order.completed", uuid: "order-uuid" })
		expect(result.status).toBe(400)
		expect(retrieve).not.toHaveBeenCalled()
		expect(send).not.toHaveBeenCalled()
	})
	it("fails closed when no webhook key is configured", async () => {
		const app = await createApp({ ...dependencies, webhookKey: undefined })
		try {
			expect(
				(
					await request(app.app)
						.post("/webhooks/dav")
						.send({ type: "order.completed", uuid: "order-uuid" })
				).status
			).toBe(400)
			expect(retrieve).not.toHaveBeenCalled()
		} finally {
			await app.server.stop()
		}
	})
	it.each([
		{},
		{ type: "order.completed" },
		{ type: "order.completed", uuid: [] }
	])("rejects malformed event %j", async payload => {
		expect((await dav(0, payload)).status).toBe(400)
		expect(retrieve).not.toHaveBeenCalled()
	})
	it("acknowledges unknown event types without effects", async () => {
		expect((await dav(0, { type: "other.event" })).status).toBe(200)
		expect(retrieve).not.toHaveBeenCalled()
	})
	it("sends both emails once across sequential and concurrent deliveries to separate apps", async () => {
		const responses = await Promise.all([dav(), dav(1), dav()])
		expect(responses.map(response => response.status)).toEqual([
			200, 200, 200
		])
		expect((await dav(1)).status).toBe(200)
		expect(send).toHaveBeenCalledTimes(2)
		expect(send).toHaveBeenCalledWith(
			expect.objectContaining({ to: "buyer@example.test" }),
			{ idempotencyKey: "dav/order.completed/order-uuid/customer" }
		)
		expect(await prisma.webhookEffect.count()).toBe(2)
	})
	it("keeps successful delivery markers across an application restart", async () => {
		expect((await dav()).status).toBe(200)
		await apps[0].server.stop()
		apps[0] = await createApp(dependencies)
		expect((await dav()).status).toBe(200)
		expect(send).toHaveBeenCalledTimes(2)
	})
	it("retries only the failed email after partial success", async () => {
		send
			.mockResolvedValueOnce({ data: { id: "admin-email" }, error: null })
			.mockResolvedValueOnce({
				data: null,
				error: { message: "Unavailable" }
			})
		expect((await dav()).status).toBe(502)
		expect(await prisma.webhookEffect.count()).toBe(1)
		expect((await dav()).status).toBe(200)
		expect(send).toHaveBeenCalledTimes(3)
		expect(send.mock.calls[1][1]).toEqual(send.mock.calls[2][1])
		expect(await prisma.webhookEffect.count()).toBe(2)
	})
	it("does not acknowledge provider timeouts as successful delivery", async () => {
		send.mockRejectedValueOnce(new Error("Timeout"))
		expect((await dav()).status).toBe(502)
		expect(await prisma.webhookEffect.count()).toBe(0)
		expect((await dav()).status).toBe(200)
		expect(send.mock.calls[0][1]).toEqual(send.mock.calls[1][1])
	})
	it("does not send emails when Stripe fails", async () => {
		paymentIntent.mockRejectedValueOnce(new Error("Timeout"))
		expect((await dav()).status).toBe(502)
		expect(send).not.toHaveBeenCalled()
		expect(await prisma.webhookEffect.count()).toBe(0)
	})
	it.each([null, ["SESSION_EXPIRED"]])(
		"handles DAV lookup failure %j",
		async response => {
			retrieve.mockResolvedValue(response as never)
			expect((await dav()).status).toBe(502)
			expect(send).not.toHaveBeenCalled()
		}
	)
	it("returns 404 for unknown ordered items without sending emails", async () => {
		await prisma.vlbItem.deleteMany()
		expect((await dav()).status).toBe(404)
		expect(send).not.toHaveBeenCalled()
	})
})

describe("Lulu print-job webhook", () => {
	it("rejects missing and incorrect signatures before any side effects", async () => {
		expect(
			(await request(apps[0].app).post("/webhooks/lulu").send(luluPayload()))
				.status
		).toBe(401)
		expect((await lulu(luluPayload(), 0, "wrong-secret")).status).toBe(401)
		expect(retrieve).not.toHaveBeenCalled()
	})
	it("verifies the exact body bytes", async () => {
		const compact = JSON.stringify(luluPayload())
		const result = await request(apps[0].app)
			.post("/webhooks/lulu")
			.set("Content-Type", "application/json")
			.set(
				"Lulu-HMAC-SHA256",
				createHmac("sha256", "test-lulu-secret")
					.update(compact)
					.digest("hex")
			)
			.send(JSON.stringify(luluPayload(), null, 2))
		expect(result.status).toBe(401)
		expect(update).not.toHaveBeenCalled()
	})
	it.each([
		{},
		{ topic: "PRINT_JOB_STATUS_CHANGED" },
		{
			topic: "PRINT_JOB_STATUS_CHANGED",
			data: {
				external_id: "order-uuid",
				status: { name: "SHIPPED" },
				line_items: [null]
			}
		}
	])("rejects malformed signed payload %j", async payload => {
		expect((await lulu(payload)).status).toBe(400)
		expect(retrieve).not.toHaveBeenCalled()
	})
	it("serializes concurrent shipments and ignores late preparation events", async () => {
		const result = await Promise.all([lulu(), lulu(luluPayload(), 1)])
		expect(result.map(response => response.status)).toEqual([200, 200])
		expect(update).toHaveBeenCalledTimes(1)
		expect(order.status).toBe("SHIPPED")
		expect((await lulu(luluPayload("PRODUCTION_IN_PROGRESS"))).status).toBe(
			200
		)
		expect(order.status).toBe("SHIPPED")
		expect(update).toHaveBeenCalledTimes(1)
	})
	it("moves a new order into preparation", async () => {
		expect((await lulu(luluPayload("PRODUCTION_IN_PROGRESS"))).status).toBe(
			200
		)
		expect(order.status).toBe("PREPARATION")
	})
	it("ignores unknown statuses", async () => {
		expect((await lulu(luluPayload("UNKNOWN"))).status).toBe(200)
		expect(update).not.toHaveBeenCalled()
	})
	it("saves printable IDs, skips reprints and tolerates missing releases", async () => {
		const { release } = await seedBook(prisma)
		const items = [
			{
				external_id: release.uuid,
				printable_id: "printable-1",
				is_reprint: false
			},
			{ external_id: "missing", printable_id: "other" }
		]
		expect((await lulu(luluPayload("SHIPPED", items))).status).toBe(200)
		expect(
			(
				await prisma.storeBookRelease.findUnique({
					where: { id: release.id }
				})
			).luluPrintableId
		).toBe("printable-1")
		expect(
			(
				await lulu(
					luluPayload("SHIPPED", [
						{
							external_id: release.uuid,
							printable_id: "reprint",
							is_reprint: true
						}
					])
				)
			).status
		).toBe(200)
		expect(
			(
				await prisma.storeBookRelease.findUnique({
					where: { id: release.id }
				})
			).luluPrintableId
		).toBe("printable-1")
	})
	it("reports update failures and allows provider retries", async () => {
		update.mockResolvedValueOnce(["SESSION_EXPIRED"])
		expect((await lulu()).status).toBe(502)
		expect(order.status).toBe("CREATED")
		expect((await lulu()).status).toBe(200)
		expect(order.status).toBe("SHIPPED")
	})
	it("catches provider transport errors", async () => {
		retrieve.mockRejectedValueOnce(new Error("Timeout"))
		expect((await lulu()).status).toBe(502)
		expect(update).not.toHaveBeenCalled()
	})
})
