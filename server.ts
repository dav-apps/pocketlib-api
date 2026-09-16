import "dotenv/config"
import { createPrismaClient } from "./src/prisma.js"
import { createClient } from "redis"
import Stripe from "stripe"
import { Resend } from "resend"
import { Dav, Environment } from "dav-js"
import { createApp } from "./src/app.js"

const port = process.env.PORT || 4001
const prisma = createPrismaClient()
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
const resend = new Resend(process.env.RESEND_API_KEY)
const redis = createClient({
	url: process.env.REDIS_URL,
	database:
		process.env.ENV == "production" ? 5 : process.env.ENV == "test" ? 15 : 4
})
redis.on("error", err => console.log("Redis Client Error", err))
await redis.connect()

let environment = Environment.Development

switch (process.env.ENV) {
	case "production":
		environment = Environment.Production
		break
	case "staging":
		environment = Environment.Staging
		break
}

new Dav({
	environment,
	server: true
})

const { httpServer } = await createApp({
	prisma,
	stripe,
	resend,
	redis,
	webhookKey: process.env.WEBHOOK_KEY,
	luluWebhookSecret:
		process.env.LULU_WEBHOOK_SECRET ||
		Buffer.from(process.env.LULU_AUTH_KEY || "", "base64")
			.toString("utf8")
			.split(":")
			.slice(1)
			.join(":")
})

await new Promise<void>(resolve => httpServer.listen({ port }, resolve))
const address = httpServer.address()
const listeningPort =
	typeof address === "object" && address ? address.port : port
console.log(`🚀 Server ready at http://localhost:${listeningPort}/`)
