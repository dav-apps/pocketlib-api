import {
	afterAll,
	beforeAll,
	beforeEach,
	afterEach,
	describe,
	expect,
	it,
	vi
} from "vitest"
import { createPrismaClient } from "../../src/prisma.js"
import {
	cachingResolver,
	invalidateCache
} from "../../src/services/cachingService.js"
import { testRedis, clearTestCache } from "../helpers/redis.js"
import { testDependencies } from "../helpers/dependencies.js"
import { createApp } from "../../src/app.js"
import { getTestDatabaseUrl } from "../../scripts/test-database.mjs"
import type { User } from "dav-js"

const redis = testRedis()
const prisma = createPrismaClient(getTestDatabaseUrl())
const context = { ...testDependencies(), redis, prisma }
const info = {
	parentType: { name: "Query" },
	fieldName: "example",
	operation: { operation: "query" }
}
let app: Awaited<ReturnType<typeof createApp>>
beforeAll(async () => {
	await redis.connect()
	app = await createApp(context)
})
beforeEach(async () => {
	vi.stubEnv("CACHING", "true")
	await clearTestCache(redis)
})
afterEach(() => vi.unstubAllEnvs())
afterAll(async () => {
	await app?.server.stop()
	await prisma.publisher.deleteMany()
	await prisma.$disconnect()
	await clearTestCache(redis)
	await redis.quit()
})
async function keys() {
	return (await redis.keys("pocketlib:cache:v2:*")).filter(
		key => !key.endsWith(":revision")
	)
}

describe("public Redis cache", () => {
	it("serves hits with BigInt IDs and Dates intact, with an atomic expiry", async () => {
		const data = {
			id: 9007199254740993n,
			createdAt: new Date("2026-01-01"),
			title: "Book"
		}
		const resolver = vi.fn(async () => ({ caching: true, data }))
		expect(await cachingResolver(null, {}, context, info, resolver)).toEqual(
			data
		)
		expect(await cachingResolver(null, {}, context, info, resolver)).toEqual(
			data
		)
		expect(resolver).toHaveBeenCalledTimes(1)
		const [key] = await keys()
		expect(await redis.ttl(key)).toBeGreaterThan(86390)
		expect(await redis.ttl(key)).toBeLessThanOrEqual(86400)
	})
	it("normalizes argument order but distinguishes delimiter-like values", async () => {
		const resolver = vi.fn(async () => ({ caching: true, data: "value" }))
		await cachingResolver(null, { a: "x", b: "y" }, context, info, resolver)
		await cachingResolver(null, { b: "y", a: "x" }, context, info, resolver)
		expect(resolver).toHaveBeenCalledTimes(1)
		await cachingResolver(null, { a: "x,b:y" }, context, info, resolver)
		expect(resolver).toHaveBeenCalledTimes(2)
	})
	it("separates fields even when GraphQL aliases match", async () => {
		const first = vi.fn(async () => ({ caching: true, data: "first" }))
		const second = vi.fn(async () => ({ caching: true, data: "second" }))
		await cachingResolver(
			null,
			{},
			context,
			{ ...info, path: { key: "same" } },
			first
		)
		expect(
			await cachingResolver(
				null,
				{},
				context,
				{ ...info, fieldName: "different", path: { key: "same" } },
				second
			)
		).toBe("second")
	})
	it("separates parent objects", async () => {
		const resolver = vi.fn(async parent => ({
			caching: true,
			data: parent.id
		}))
		expect(
			await cachingResolver({ id: 1n }, {}, context, info, resolver)
		).toBe(1n)
		expect(
			await cachingResolver({ id: 2n }, {}, context, info, resolver)
		).toBe(2n)
	})
	it("never shares authenticated results with guests or other users", async () => {
		const resolver = vi.fn(async (_, __, ctx) => ({
			caching: true,
			data: ctx.user?.Id ?? "public"
		}))
		expect(
			await cachingResolver(
				null,
				{},
				{ ...context, user: { Id: 42 } as User },
				info,
				resolver
			)
		).toBe(42)
		expect(await cachingResolver(null, {}, context, info, resolver)).toBe(
			"public"
		)
		expect(
			await cachingResolver(
				null,
				{},
				{ ...context, user: { Id: 43 } as User },
				info,
				resolver
			)
		).toBe(43)
		expect(await keys()).toHaveLength(1)
	})
	it("does not cache resolver results marked private", async () => {
		const resolver = vi.fn(async () => ({ caching: false, data: "private" }))
		await cachingResolver(null, {}, context, info, resolver)
		await cachingResolver(null, {}, context, info, resolver)
		expect(resolver).toHaveBeenCalledTimes(2)
		expect(await keys()).toHaveLength(0)
	})
	it("honors disabled caching", async () => {
		vi.stubEnv("CACHING", "false")
		const resolver = vi.fn(async () => ({ caching: true, data: "fresh" }))
		await cachingResolver(null, {}, context, info, resolver)
		await cachingResolver(null, {}, context, info, resolver)
		expect(resolver).toHaveBeenCalledTimes(2)
		expect(await keys()).toHaveLength(0)
	})
	it("reloads expired entries without sleeping for the production TTL", async () => {
		const resolver = vi.fn(async () => ({ caching: true, data: "fresh" }))
		await cachingResolver(null, {}, context, info, resolver)
		await redis.pExpire((await keys())[0], 1)
		await vi.waitFor(async () => expect(await keys()).toHaveLength(0))
		await cachingResolver(null, {}, context, info, resolver)
		expect(resolver).toHaveBeenCalledTimes(2)
	})
	it("invalidates previous entries after a write", async () => {
		const resolver = vi.fn(async () => ({ caching: true, data: "fresh" }))
		await cachingResolver(null, {}, context, info, resolver)
		await invalidateCache(redis)
		await cachingResolver(null, {}, context, info, resolver)
		expect(resolver).toHaveBeenCalledTimes(2)
	})
	it("falls back when an entry is corrupt or Redis is unavailable", async () => {
		const resolver = vi.fn(async () => ({ caching: true, data: "fresh" }))
		await cachingResolver(null, {}, context, info, resolver)
		await redis.set((await keys())[0], "corrupt")
		expect(await cachingResolver(null, {}, context, info, resolver)).toBe(
			"fresh"
		)
		const disconnected = testRedis()
		expect(
			await cachingResolver(
				null,
				{},
				{ ...context, redis: disconnected },
				info,
				resolver
			)
		).toBe("fresh")
		expect(resolver).toHaveBeenCalledTimes(3)
	})
	it("invalidates a real GraphQL read after an authenticated mutation", async () => {
		await prisma.publisher.deleteMany()
		const publisher = await prisma.publisher.create({
			data: {
				uuid: "9ff39665-bfdc-4d14-857f-db057712026e",
				userId: 42n,
				name: "Old name"
			}
		})
		async function execute(query: string, user?: User) {
			const response = await app.server.executeOperation(
				{ query },
				{ contextValue: { ...context, user } }
			)
			if (response.body.kind !== "single")
				throw new Error("Expected single result")
			expect(response.body.singleResult.errors).toBeUndefined()
			return response.body.singleResult.data
		}
		const query = `{ retrievePublisher(uuid: "${publisher.uuid}") { name } }`
		expect(await execute(query)).toEqual({
			retrievePublisher: { name: "Old name" }
		})
		await execute(
			'mutation { updatePublisher(uuid: "mine", name: "New name") { name } }',
			{ Id: 42 } as User
		)
		expect(await execute(query)).toEqual({
			retrievePublisher: { name: "New name" }
		})
	})
})
