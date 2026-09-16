import { Express, Request, Response, raw } from "express"
import cors from "cors"
import { createHmac, timingSafeEqual } from "node:crypto"
import { Auth, OrdersController, OrderResource, OrderStatus } from "dav-js"
import type { AppDependencies } from "../appDependencies.js"
import { withWebhookLock } from "../services/webhookService.js"

type Dependencies = Pick<AppDependencies, "prisma" | "luluWebhookSecret">

async function luluWebhook(
	req: Request,
	res: Response,
	{ prisma, luluWebhookSecret }: Dependencies
) {
	const signature = req.get("Lulu-HMAC-SHA256")
	if (!luluWebhookSecret || !signature || !Buffer.isBuffer(req.body))
		return res.sendStatus(401)
	const expected = createHmac("sha256", luluWebhookSecret)
		.update(req.body)
		.digest()
	// Accept the two common textual encodings of the same SHA-256 digest.
	const received = /^[a-fA-F0-9]{64}$/.test(signature)
		? Buffer.from(signature, "hex")
		: Buffer.from(signature, "base64")
	if (
		received.length !== expected.length ||
		!timingSafeEqual(expected, received)
	)
		return res.sendStatus(401)

	let payload: any
	try {
		payload = JSON.parse(req.body.toString("utf8"))
	} catch {
		return res.sendStatus(400)
	}
	if (!payload || typeof payload.topic !== "string") return res.sendStatus(400)
	if (payload.topic !== "PRINT_JOB_STATUS_CHANGED") return res.sendStatus(200)
	const data = payload.data
	if (
		typeof data?.external_id !== "string" ||
		!data.external_id ||
		typeof data.status?.name !== "string" ||
		!Array.isArray(data.line_items) ||
		data.line_items.some(item => !item || typeof item !== "object")
	)
		return res.sendStatus(400)
	const externalId = data.external_id
	const status = data.status.name
	const preparationStates = [
		"CREATED",
		"UNPAID",
		"PAYMENT_IN_PROGRESS",
		"PRODUCTION_READY",
		"PRODUCTION_IN_PROGRESS"
	]
	if (status !== "SHIPPED" && !preparationStates.includes(status))
		return res.sendStatus(200)

	const auth = new Auth({
		apiKey: process.env.DAV_API_KEY,
		secretKey: process.env.DAV_SECRET_KEY,
		uuid: process.env.DAV_UUID
	})
	await withWebhookLock(prisma, `lulu/order/${externalId}`, async tx => {
		const response = await OrdersController.retrieveOrder(`uuid status`, {
			auth,
			uuid: externalId
		})
		if (response == null || Array.isArray(response))
			throw new Error("Order lookup failed")
		const order = response as OrderResource
		const newOrderStatus: OrderStatus =
			status === "SHIPPED" ? "SHIPPED" : "PREPARATION"
		// Late production events must never move an already shipped order backwards.
		if (order.status !== "SHIPPED" && order.status !== newOrderStatus) {
			const update = await OrdersController.updateOrder(`uuid`, {
				auth,
				uuid: order.uuid,
				status: newOrderStatus
			})
			if (update == null || Array.isArray(update))
				throw new Error("Order update failed")
		}
		for (const item of data.line_items) {
			if (
				item.is_reprint ||
				typeof item.external_id !== "string" ||
				typeof item.printable_id !== "string" ||
				!item.printable_id
			)
				continue
			const release = await tx.storeBookRelease.findUnique({
				where: { uuid: item.external_id }
			})
			if (!release || release.luluPrintableId === item.printable_id) continue
			await tx.storeBookRelease.update({
				where: { id: release.id },
				data: { luluPrintableId: item.printable_id }
			})
		}
	})
	res.sendStatus(200)
}

export function setup(app: Express, dependencies: Dependencies) {
	app.post(
		"/webhooks/lulu",
		raw({ type: "application/json", limit: "1mb" }),
		cors(),
		(req, res) =>
			luluWebhook(req, res, dependencies).catch(() => res.sendStatus(502))
	)
}
