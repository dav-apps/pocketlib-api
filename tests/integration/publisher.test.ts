import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest"
import { PrismaClient } from "@prisma/client"
import type { User } from "dav-js"
import { createApp } from "../../src/app.js"
import { testDependencies } from "../helpers/dependencies.js"
import { getTestDatabaseUrl } from "../../scripts/test-database.mjs"
import { admins } from "../../src/constants.js"

const prisma = new PrismaClient({
	datasources: { db: { url: getTestDatabaseUrl() } }
})
const dependencies = { ...testDependencies(), prisma }
let application: Awaited<ReturnType<typeof createApp>>
const publisherUuid = "a745a998-df99-4c75-b074-8ad32f434be1"

beforeAll(async () => {
	await prisma.$connect()
	application = await createApp(dependencies)
})

beforeEach(async () => {
	await prisma.publisher.deleteMany()
	await prisma.publisher.createMany({
		data: [
			{
				uuid: publisherUuid,
				slug: "owner-publisher",
				userId: 42n,
				name: "Owner publisher"
			},
			{
				uuid: "ec38a18e-6bd2-445e-8e7d-3ad4c986f5b7",
				slug: "other-publisher",
				userId: 43n,
				name: "Other publisher"
			}
		]
	})
})

afterAll(async () => {
	try {
		await application?.server.stop()
		await prisma.publisher.deleteMany()
	} finally {
		await prisma.$disconnect()
	}
})

async function execute(query: string, userId: number | null) {
	const result = await application.server.executeOperation(
		{ query },
		{
			contextValue: {
				...dependencies,
				user: userId === null ? null : ({ Id: userId } as User)
			}
		}
	)
	if (result.body.kind !== "single")
		throw new Error("Expected a single response")
	return result.body.singleResult
}

describe("publisher permissions with PostgreSQL and the application schema", () => {
	it.each([42, 43])(
		"mine returns only the publisher of user %i",
		async userId => {
			const result = await execute(
				'{ retrievePublisher(uuid: "mine") { uuid name } }',
				userId
			)
			expect(result.errors).toBeUndefined()
			expect(result.data?.retrievePublisher).toEqual(
				userId === 42
					? { uuid: publisherUuid, name: "Owner publisher" }
					: {
							uuid: "ec38a18e-6bd2-445e-8e7d-3ad4c986f5b7",
							name: "Other publisher"
						}
			)
		}
	)
	it("allows the owner to update their publisher without changing another user's data", async () => {
		const result = await execute(
			'mutation { updatePublisher(uuid: "mine", name: "Updated name") { name } }',
			42
		)
		expect(result.errors).toBeUndefined()
		expect(result.data?.updatePublisher).toEqual({ name: "Updated name" })
		expect(
			(await prisma.publisher.findUnique({ where: { uuid: publisherUuid } }))
				.name
		).toBe("Updated name")
		expect(
			(await prisma.publisher.findFirst({ where: { userId: 43n } })).name
		).toBe("Other publisher")
	})
	it.each([
		[null, "NOT_AUTHENTICATED"],
		[43, "ACTION_NOT_ALLOWED"]
	] as const)(
		"rejects updates by user %s without changing stored data",
		async (userId, errorCode) => {
			const before = await prisma.publisher.findMany({
				orderBy: { id: "asc" }
			})
			const result = await execute(
				`mutation { updatePublisher(uuid: "${publisherUuid}", name: "Forbidden change") { name } }`,
				userId
			)
			expect(result.errors?.[0].extensions.code).toBe(errorCode)
			expect(result.data?.updatePublisher).toBeNull()
			expect(
				await prisma.publisher.findMany({ orderBy: { id: "asc" } })
			).toEqual(before)
		}
	)
	it("allows an admin to update a publisher by UUID", async () => {
		const result = await execute(
			`mutation { updatePublisher(uuid: "${publisherUuid}", name: "Admin update") { name } }`,
			admins[0]
		)
		expect(result.errors).toBeUndefined()
		expect(
			(await prisma.publisher.findUnique({ where: { uuid: publisherUuid } }))
				.name
		).toBe("Admin update")
	})
})
