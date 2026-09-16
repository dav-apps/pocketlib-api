import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { spawn, type ChildProcess } from "node:child_process"
import { once } from "node:events"
import { fileURLToPath } from "node:url"
import { PrismaClient } from "@prisma/client"
import { getTestDatabaseUrl } from "../../scripts/test-database.mjs"
import { getTestRedisUrl } from "../../scripts/test-redis.mjs"
import { testRedis, clearTestCache } from "../helpers/redis.js"

const databaseUrl = getTestDatabaseUrl()
const redisUrl = getTestRedisUrl()
const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } })
const redis = testRedis()
let child: ChildProcess
let baseUrl: string
let output = ""
const uuid = "4cd3d617-26d2-4d3e-9d73-d18d681853e0"

beforeAll(async () => {
	await redis.connect()
	await clearTestCache(redis)
	await prisma.publisher.deleteMany()
	await prisma.publisher.create({
		data: {
			uuid,
			userId: 42n,
			slug: "system-publisher",
			name: "System publisher"
		}
	})
	child = spawn(
		process.execPath,
		[
			"--import",
			fileURLToPath(new URL("./block-network.mjs", import.meta.url)),
			"dist/server.js"
		],
		{
			cwd: process.cwd(),
			stdio: ["ignore", "pipe", "pipe"],
			// Deliberately do not inherit developer credentials or load the local .env.
			env: {
				PATH: process.env.PATH,
				NODE_ENV: "test",
				ENV: "test",
				DOTENV_CONFIG_PATH: "/dev/null",
				PORT: "0",
				DATABASE_URL: databaseUrl,
				REDIS_URL: redisUrl,
				CACHING: "true",
				STRIPE_SECRET_KEY: "sk_test_placeholder",
				RESEND_API_KEY: "re_placeholder",
				WEBHOOK_KEY: "system-webhook-key",
				DAV_API_KEY: "test",
				DAV_SECRET_KEY: "test",
				DAV_UUID: "test",
				LULU_WEBHOOK_SECRET: "test"
			}
		}
	)
	await new Promise<void>((resolve, reject) => {
		const timer = setTimeout(
			() => reject(new Error(`Server startup timed out:\n${output}`)),
			15000
		)
		child.once("error", error => {
			clearTimeout(timer)
			reject(error)
		})
		child.once("exit", code => {
			clearTimeout(timer)
			reject(new Error(`Server exited (${code}):\n${output}`))
		})
		child.stderr.on("data", data => {
			output += data.toString()
		})
		child.stdout.on("data", data => {
			output += data.toString()
			const match = output.match(
				/Server ready at http:\/\/localhost:(\d+)\//
			)
			if (match) {
				baseUrl = `http://127.0.0.1:${match[1]}`
				clearTimeout(timer)
				resolve()
			}
		})
	})
})
afterAll(async () => {
	try {
		if (child && child.exitCode == null && child.signalCode == null) {
			const exited = once(child, "exit")
			child.kill("SIGTERM")
			const timer = setTimeout(() => child.kill("SIGKILL"), 5000)
			try {
				await exited
			} finally {
				clearTimeout(timer)
			}
		}
		await prisma.publisher.deleteMany()
		if (redis.isOpen) await clearTestCache(redis)
	} finally {
		await prisma.$disconnect()
		if (redis.isOpen) await redis.quit()
	}
})
async function graphql(query: string) {
	const response = await fetch(baseUrl, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ query })
	})
	return { status: response.status, body: await response.json() }
}

describe("built production entry point", () => {
	it("starts with real PostgreSQL and Redis and serves GraphQL", async () => {
		expect(await graphql("{ __typename }")).toEqual({
			status: 200,
			body: { data: { __typename: "Query" } }
		})
	})
	it("returns a database-backed response on both cold and warm cache reads", async () => {
		const query = `{ retrievePublisher(uuid: "${uuid}") { name } }`
		const expected = {
			status: 200,
			body: { data: { retrievePublisher: { name: "System publisher" } } }
		}
		expect(await graphql(query)).toEqual(expected)
		expect(await graphql(query)).toEqual(expected)
		expect((await redis.keys("pocketlib:cache:v2:*")).length).toBeGreaterThan(
			1
		)
	})
	it("enforces authentication on a mutation without writing", async () => {
		const result = await graphql(
			'mutation { createPublisher(name: "Forbidden") { uuid } }'
		)
		expect(result.status).toBe(200)
		expect(result.body.errors[0].extensions.code).toBe("NOT_AUTHENTICATED")
		expect(await prisma.publisher.count()).toBe(1)
	})
	it("serves the actual binary upload and webhook routes", async () => {
		const upload = await fetch(`${baseUrl}/publishers/mine/logo`, {
			method: "PUT",
			headers: { "Content-Type": "image/png" },
			body: Buffer.from("test")
		})
		expect(upload.status).toBe(401)
		const webhook = await fetch(`${baseUrl}/webhooks/dav`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ type: "order.completed", uuid: "ignored" })
		})
		expect(webhook.status).toBe(400)
	})
})
