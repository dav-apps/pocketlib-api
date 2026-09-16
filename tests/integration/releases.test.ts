import {
	afterAll,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	vi
} from "vitest"
import { getDocument } from "pdfjs-dist"
import { createPrismaClient } from "../../src/prisma.js"
import { TableObjectsController, type User } from "dav-js"
import { createApp } from "../../src/app.js"
import { getLastReleaseOfStoreBook } from "../../src/utils.js"
import { testDependencies } from "../helpers/dependencies.js"
import { clearBooks, seedBook } from "../helpers/books.js"
import { getTestDatabaseUrl } from "../../scripts/test-database.mjs"

vi.mock("dav-js", async importOriginal => {
	const actual = await importOriginal<typeof import("dav-js")>()
	return {
		...actual,
		TableObjectsController: {
			...actual.TableObjectsController,
			createTableObject: vi.fn()
		}
	}
})
// PDF parsing is covered separately; these tests exercise publication and persistence.
vi.mock("pdfjs-dist", () => ({
	getDocument: vi.fn(() => {
		throw new Error("Unexpected PDF download")
	})
}))

const prisma = createPrismaClient(getTestDatabaseUrl())
const dependencies = { ...testDependencies(), prisma }
let app: Awaited<ReturnType<typeof createApp>>
beforeAll(async () => {
	app = await createApp(dependencies)
})
beforeEach(async () => {
	await clearBooks(prisma)
	vi.mocked(getDocument)
		.mockReset()
		.mockImplementation(() => {
			throw new Error("Unexpected PDF download")
		})
	vi.mocked(TableObjectsController.createTableObject)
		.mockReset()
		.mockImplementation(async (_, args) => ({ uuid: args.uuid }) as never)
})
afterAll(async () => {
	try {
		await app?.server.stop()
		await clearBooks(prisma)
	} finally {
		await prisma.$disconnect()
	}
})

async function execute(query: string, userId: number | null = 42) {
	const result = await app.server.executeOperation(
		{ query },
		{
			contextValue: {
				...dependencies,
				accessToken: "test-token",
				user: userId == null ? null : ({ Id: userId } as User)
			}
		}
	)
	if (result.body.kind !== "single") throw new Error("Expected single result")
	return result.body.singleResult
}
async function snapshot() {
	return {
		books: await prisma.storeBook.findMany({ orderBy: { id: "asc" } }),
		releases: await prisma.storeBookRelease.findMany({
			orderBy: { id: "asc" }
		})
	}
}

describe("book release lifecycle", () => {
	it.each([
		["unpublished", "review"],
		["review", "unpublished"],
		["published", "hidden"],
		["hidden", "published"]
	])("owner can move %s to %s", async (from, to) => {
		const { book } = await seedBook(prisma, from)
		const result = await execute(
			`mutation { updateStoreBook(uuid: "${book.uuid}", status: "${to}") { status } }`
		)
		expect(result.errors).toBeUndefined()
		expect(result.data?.updateStoreBook).toEqual({ status: to })
		expect(
			(await prisma.storeBook.findUnique({ where: { id: book.id } })).status
		).toBe(to)
	})
	it.each([
		["unpublished", "published"],
		["review", "published"],
		["published", "review"],
		["hidden", "review"]
	])(
		"rejects %s to %s without creating a draft or changing language",
		async (from, to) => {
			const { book } = await seedBook(prisma, from, "published")
			const before = await snapshot()
			const result = await execute(
				`mutation { updateStoreBook(uuid: "${book.uuid}", status: "${to}") { uuid } }`
			)
			expect(result.errors?.[0].extensions.code).toBe("ACTION_NOT_ALLOWED")
			expect(await snapshot()).toEqual(before)
			expect(TableObjectsController.createTableObject).not.toHaveBeenCalled()
		}
	)
	it("rejects a missing book with a domain error", async () => {
		const result = await execute(
			'mutation { updateStoreBook(uuid: "missing", title: "New title") { uuid } }'
		)
		expect(result.errors?.[0].extensions.code).toBe("STORE_BOOK_NOT_EXISTS")
	})
	it.each([null, 43])(
		"rejects updates by user %s without writes",
		async user => {
			const { book } = await seedBook(prisma)
			const before = await snapshot()
			const result = await execute(
				`mutation { updateStoreBook(uuid: "${book.uuid}", title: "Forbidden") { uuid } }`,
				user
			)
			expect(result.errors?.[0].extensions.code).toBe(
				user == null ? "NOT_AUTHENTICATED" : "ACTION_NOT_ALLOWED"
			)
			expect(await snapshot()).toEqual(before)
		}
	)
	it("creates a draft on editing, preserving the published release and its files", async () => {
		const { book, release } = await seedBook(prisma, "published", "published")
		const result = await execute(
			`mutation { updateStoreBook(uuid: "${book.uuid}", title: "Revised title") { title } }`
		)
		expect(result.errors).toBeUndefined()
		expect(result.data?.updateStoreBook).toEqual({ title: "Revised title" })
		expect(
			await prisma.storeBookRelease.findUnique({ where: { id: release.id } })
		).toEqual(release)
		const draft = await getLastReleaseOfStoreBook(prisma, book.id, false)
		expect(draft).toMatchObject({
			status: "unpublished",
			publishedAt: null,
			title: "Revised title",
			coverId: release.coverId,
			fileId: release.fileId
		})
		expect(await getLastReleaseOfStoreBook(prisma, book.id, true)).toEqual(
			release
		)
		expect(TableObjectsController.createTableObject).toHaveBeenCalledOnce()
	})
	it("rejects invalid publication before changing book or release", async () => {
		const { book, release } = await seedBook(prisma, "unpublished")
		await prisma.storeBookRelease.update({
			where: { id: release.id },
			data: { description: null, fileId: null }
		})
		const before = await snapshot()
		const result = await execute(
			`mutation { updateStoreBook(uuid: "${book.uuid}", status: "review", language: "en") { uuid } }`
		)
		expect(result.errors?.[0].extensions).toMatchObject({
			code: "VALIDATION_FAILED",
			errors: expect.arrayContaining([
				"CANNOT_PUBLISH_STORE_BOOK_WITHOUT_DESCRIPTION",
				"CANNOT_PUBLISH_STORE_BOOK_WITHOUT_FILE"
			])
		})
		expect(await snapshot()).toEqual(before)
	})
	it("validates the updated description when submitting for review", async () => {
		const { book, release } = await seedBook(prisma, "unpublished")
		await prisma.storeBookRelease.update({
			where: { id: release.id },
			data: { description: null }
		})
		const result = await execute(
			`mutation { updateStoreBook(uuid: "${book.uuid}", description: "New description", status: "review") { status } }`
		)
		expect(result.errors).toBeUndefined()
	})
	it("admin publication records its timestamp", async () => {
		const { book, release } = await seedBook(prisma, "review")
		const before = Date.now()
		const result = await execute(
			`mutation { updateStoreBook(uuid: "${book.uuid}", status: "published") { status } }`,
			1
		)
		expect(result.errors).toBeUndefined()
		const saved = await prisma.storeBookRelease.findUnique({
			where: { id: release.id }
		})
		expect(saved.status).toBe("published")
		expect(saved.publishedAt?.getTime()).toBeGreaterThanOrEqual(before)
	})
	it.each([42, 1])(
		"user %s can publish a subsequent ebook release once",
		async user => {
			const { release } = await seedBook(prisma)
			await prisma.storeBookRelease.update({
				where: { id: release.id },
				data: { printCoverId: null, printFileId: null }
			})
			const query = `mutation { publishStoreBookRelease(uuid: "${release.uuid}", releaseName: "Version 2") { status releaseName } }`
			const first = await execute(query, user)
			expect(first.errors).toBeUndefined()
			expect(first.data?.publishStoreBookRelease).toEqual({
				status: "published",
				releaseName: "Version 2"
			})
			const before = await snapshot()
			const duplicate = await execute(query, user)
			expect(duplicate.errors?.[0].extensions.code).toBe(
				"STORE_BOOK_RELEASE_ALREADY_PUBLISHED"
			)
			expect(await snapshot()).toEqual(before)
		}
	)
	it.each([
		[null, "NOT_AUTHENTICATED"],
		[43, "ACTION_NOT_ALLOWED"]
	] as const)("user %s cannot publish another release", async (user, code) => {
		const { release } = await seedBook(prisma)
		const before = await snapshot()
		const result = await execute(
			`mutation { publishStoreBookRelease(uuid: "${release.uuid}", releaseName: "Version 2") { uuid } }`,
			user
		)
		expect(result.errors?.[0].extensions.code).toBe(code)
		expect(await snapshot()).toEqual(before)
	})
	it("requires a published or hidden parent book", async () => {
		const { release } = await seedBook(prisma, "review")
		const before = await snapshot()
		const result = await execute(
			`mutation { publishStoreBookRelease(uuid: "${release.uuid}", releaseName: "Version 2") { uuid } }`
		)
		expect(result.errors?.[0].extensions.code).toBe(
			"STORE_BOOK_NOT_PUBLISHED"
		)
		expect(await snapshot()).toEqual(before)
	})
	it("does not create a local draft when DAV rejects creation", async () => {
		const { book } = await seedBook(prisma, "published", "published")
		const before = await snapshot()
		vi.mocked(TableObjectsController.createTableObject).mockResolvedValue([
			"SESSION_EXPIRED"
		])
		const result = await execute(
			`mutation { updateStoreBook(uuid: "${book.uuid}", title: "New title") { uuid } }`
		)
		expect(result.errors?.[0].extensions.code).toBe("UNEXPECTED_ERROR")
		expect(await snapshot()).toEqual(before)
	})
	it("allows only one of two concurrent publication attempts", async () => {
		const { release } = await seedBook(prisma)
		await prisma.storeBookRelease.update({
			where: { id: release.id },
			data: { printCoverId: null, printFileId: null }
		})
		const query = `mutation { publishStoreBookRelease(uuid: "${release.uuid}", releaseName: "Version 2") { uuid } }`
		const results = await Promise.all([execute(query), execute(query)])
		expect(results.filter(result => !result.errors)).toHaveLength(1)
		expect(
			results.find(result => result.errors)?.errors[0].extensions.code
		).toBe("STORE_BOOK_RELEASE_ALREADY_PUBLISHED")
	})
	it.each([31, 1000])(
		"rejects a print PDF with %i pages without publishing",
		async pages => {
			const { release } = await seedBook(prisma)
			vi.mocked(getDocument).mockReturnValue({
				promise: Promise.resolve({ numPages: pages })
			} as never)
			const before = await snapshot()
			const result = await execute(
				`mutation { publishStoreBookRelease(uuid: "${release.uuid}", releaseName: "Version 2") { uuid } }`
			)
			expect(result.errors?.[0].extensions).toMatchObject({
				code: "VALIDATION_FAILED",
				errors: ["PRINT_FILE_PAGES_INVALID"]
			})
			expect(await snapshot()).toEqual(before)
		}
	)
	it("rejects a PDF with one invalid interior page", async () => {
		const { release } = await seedBook(prisma)
		vi.mocked(getDocument).mockReturnValue({
			promise: Promise.resolve({
				numPages: 32,
				getPage: async (page: number) => ({
					_pageInfo: {
						view: page === 32 ? [0, 0, 595, 842] : [0, 0, 396, 612]
					}
				})
			})
		} as never)
		const before = await snapshot()
		const result = await execute(
			`mutation { publishStoreBookRelease(uuid: "${release.uuid}", releaseName: "Version 2") { uuid } }`
		)
		expect(result.errors?.[0].extensions).toMatchObject({
			code: "VALIDATION_FAILED",
			errors: ["PRINT_FILE_PAGE_SIZE_INVALID"]
		})
		expect(await snapshot()).toEqual(before)
	})
	it("publishes when all interior pages and the cover have valid dimensions", async () => {
		const { release } = await seedBook(prisma)
		vi.mocked(getDocument)
			.mockReturnValueOnce({
				promise: Promise.resolve({
					numPages: 100,
					getPage: async () => ({ _pageInfo: { view: [0, 0, 396, 612] } })
				})
			} as never)
			.mockReturnValueOnce({
				promise: Promise.resolve({
					numPages: 1,
					getPage: async () => ({
						_pageInfo: { view: [0, 0, 11.6 * 72, 8.8 * 72] }
					})
				})
			} as never)
		const result = await execute(
			`mutation { publishStoreBookRelease(uuid: "${release.uuid}", releaseName: "Version 2") { status } }`
		)
		expect(result.errors).toBeUndefined()
		expect(result.data?.publishStoreBookRelease).toEqual({
			status: "published"
		})
	})
})
