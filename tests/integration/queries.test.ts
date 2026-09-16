import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest"
import { randomUUID } from "node:crypto"
import { PrismaClient } from "@prisma/client"
import { createApp } from "../../src/app.js"
import { testDependencies } from "../helpers/dependencies.js"
import { clearBooks, seedBook } from "../helpers/books.js"
import { getTestDatabaseUrl } from "../../scripts/test-database.mjs"
const prisma = new PrismaClient({
	datasources: { db: { url: getTestDatabaseUrl() } }
})
const context = { ...testDependencies(), prisma }
let app: Awaited<ReturnType<typeof createApp>>
let german: Awaited<ReturnType<typeof seedBook>>,
	english: Awaited<ReturnType<typeof seedBook>>,
	hidden: Awaited<ReturnType<typeof seedBook>>,
	review: Awaited<ReturnType<typeof seedBook>>
async function clean() {
	await clearBooks(prisma)
	await prisma.categoryName.deleteMany()
	await prisma.category.deleteMany()
	await prisma.publisher.deleteMany()
}
beforeAll(async () => {
	app = await createApp(context)
})
beforeEach(async () => {
	await clean()
	german = await seedBook(prisma, "published", "published")
	english = await seedBook(prisma, "published", "published")
	hidden = await seedBook(prisma, "hidden", "published")
	review = await seedBook(prisma, "review", "unpublished")
	await prisma.storeBook.update({
		where: { id: english.book.id },
		data: { language: "en" }
	})
	await prisma.storeBookRelease.update({
		where: { id: german.release.id },
		data: {
			title: "German story",
			description: "A wonderful journey",
			isbn: "9781234567890"
		}
	})
	const category = await prisma.category.create({
		data: {
			uuid: randomUUID(),
			userId: 1n,
			key: "fiction",
			releases: {
				connect: [german.release, english.release, hidden.release].map(
					({ id }) => ({ id })
				)
			}
		}
	})
	await prisma.categoryName.createMany({
		data: [
			{
				uuid: randomUUID(),
				userId: 1n,
				categoryId: category.id,
				language: "en",
				name: "Fiction"
			},
			{
				uuid: randomUUID(),
				userId: 1n,
				categoryId: category.id,
				language: "de",
				name: "Belletristik"
			}
		]
	})
})
afterAll(async () => {
	try {
		await app?.server.stop()
		await clean()
	} finally {
		await prisma.$disconnect()
	}
})
async function execute(query: string, userId?: number) {
	const result = await app.server.executeOperation(
		{ query },
		{
			contextValue: {
				...context,
				user: userId == null ? null : ({ Id: userId } as never)
			}
		}
	)
	if (result.body.kind !== "single") throw new Error("Expected single result")
	return result.body.singleResult
}
async function list(args = "", userId?: number) {
	const result = await execute(
		`{ listStoreBooks${args ? `(${args})` : ""} { total items { uuid title language status } } }`,
		userId
	)
	expect(result.errors).toBeUndefined()
	return result.data.listStoreBooks as {
		total: number
		items: { uuid: string; title: string; language: string; status: string }[]
	}
}
describe("catalog queries", () => {
	it("paginates published books with a stable order and unpaginated total", async () => {
		const first = await list("limit: 1, offset: 0")
		const second = await list("limit: 1, offset: 1")
		expect(first.total).toBe(2)
		expect(first.items.map(item => item.uuid)).toEqual([english.book.uuid])
		expect(second.items.map(item => item.uuid)).toEqual([german.book.uuid])
		expect((await list("offset: 100")).items).toEqual([])
	})
	it("normalizes nonpositive limits and negative offsets", async () => {
		expect((await list("limit: 0, offset: -1")).items).toHaveLength(2)
	})
	it.each([
		'languages: ["de"]',
		'categories: ["fiction"], languages: ["de"]',
		'query: "JOURNEY", languages: ["de"]',
		'query: "9781234567890"'
	])("applies filters %s", async args => {
		const result = await list(args)
		expect(result.total).toBe(1)
		expect(result.items[0].uuid).toBe(german.book.uuid)
	})
	it("excludes hidden books even when filtering by category", async () => {
		const result = await list('categories: ["fiction"]')
		expect(result.total).toBe(2)
		expect(result.items.map(item => item.uuid)).not.toContain(
			hidden.book.uuid
		)
	})
	it("does not match private draft titles in public search", async () => {
		await prisma.storeBookRelease.create({
			data: {
				uuid: randomUUID(),
				userId: 42n,
				storeBookId: german.book.id,
				title: "Secret draft",
				status: "unpublished"
			}
		})
		expect((await list('query: "Secret draft"')).total).toBe(0)
	})
	it("random selection respects visibility and language filters", async () => {
		const result = await list('random: true, languages: ["de"], limit: 10')
		expect(result.items.map(item => item.uuid)).toEqual([german.book.uuid])
	})
	it.each([undefined, 42])(
		"restricts the review list for user %s even with category filters",
		async userId => {
			const result = await execute(
				'{ listStoreBooks(inReview: true, categories: ["fiction"]) { total } }',
				userId
			)
			expect(result.errors?.[0].extensions.code).toBe(
				userId == null ? "NOT_AUTHENTICATED" : "ACTION_NOT_ALLOWED"
			)
		}
	)
	it("lets admins review books owned by other users", async () => {
		expect(
			(await list("inReview: true", 1)).items.map(item => item.uuid)
		).toEqual([review.book.uuid])
	})
	it("retrieves the same publisher by UUID and slug and handles a missing item", async () => {
		const publisher = await prisma.publisher.create({
			data: {
				uuid: randomUUID(),
				userId: 42n,
				slug: "example-publisher",
				name: "Example"
			}
		})
		const result = await execute(
			`{ byId: retrievePublisher(uuid: "${publisher.uuid}") { name } bySlug: retrievePublisher(uuid: "example-publisher") { name } missing: retrievePublisher(uuid: "missing") { uuid } }`
		)
		expect(result.errors).toBeUndefined()
		expect(result.data).toEqual({
			byId: { name: "Example" },
			bySlug: { name: "Example" },
			missing: null
		})
	})
	it("paginates publishers independently of their total", async () => {
		await prisma.publisher.createMany({
			data: ["First", "Second", "Third"].map(name => ({
				uuid: randomUUID(),
				userId: 42n,
				name
			}))
		})
		const result = await execute(
			"{ listPublishers(limit: 1, offset: 1) { total items { name } } }"
		)
		expect(result.errors).toBeUndefined()
		expect(result.data.listPublishers).toEqual({
			total: 3,
			items: [{ name: "Second" }]
		})
	})
	it("resolves localized category names through the schema", async () => {
		const result = await execute(
			'{ listCategories { total items { key name(language: "de") { name language } names(limit: 1) { total items { language } } } } }'
		)
		expect(result.errors).toBeUndefined()
		expect(result.data.listCategories).toMatchObject({
			total: 1,
			items: [
				{
					key: "fiction",
					name: { name: "Belletristik", language: "de" },
					names: { total: 2, items: expect.any(Array) }
				}
			]
		})
	})
})
