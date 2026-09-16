import {
	afterAll,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	vi
} from "vitest"
import { randomUUID } from "node:crypto"
import { PrismaClient } from "@prisma/client"
import { Plan, TableObjectsController, UsersController } from "dav-js"
import request from "supertest"
import nock from "nock"
import { createApp } from "../../src/app.js"
import { getTableObjectFileUrl } from "../../src/utils.js"
import { testDependencies } from "../helpers/dependencies.js"
import { clearBooks, seedBook } from "../helpers/books.js"
import { imageFile, pdfFile } from "../helpers/files.js"
import { getTestDatabaseUrl } from "../../scripts/test-database.mjs"

vi.mock("dav-js", async importOriginal => {
	const actual = await importOriginal<typeof import("dav-js")>()
	return {
		...actual,
		UsersController: { ...actual.UsersController, retrieveUser: vi.fn() },
		TableObjectsController: {
			...actual.TableObjectsController,
			createTableObject: vi.fn(),
			updateTableObject: vi.fn(),
			uploadTableObjectFile: vi.fn()
		}
	}
})
const prisma = new PrismaClient({
	datasources: { db: { url: getTestDatabaseUrl() } }
})
const dependencies = { ...testDependencies(), prisma }
let app: Awaited<ReturnType<typeof createApp>>
const create = vi.mocked(TableObjectsController.createTableObject)
const upload = vi.mocked(TableObjectsController.uploadTableObjectFile)
const user = {
	id: 42,
	email: "owner@example.test",
	firstName: "Owner",
	plan: Plan.Free
}
beforeAll(async () => {
	app = await createApp(dependencies)
})
beforeEach(async () => {
	vi.resetAllMocks()
	await clearBooks(prisma)
	vi.mocked(UsersController.retrieveUser).mockResolvedValue(user as never)
	create.mockImplementation(
		async (_, args) => ({ uuid: args.uuid ?? randomUUID() }) as never
	)
	vi.mocked(TableObjectsController.updateTableObject).mockResolvedValue({
		uuid: "updated"
	} as never)
	upload.mockResolvedValue({ status: 200 } as never)
})
afterAll(async () => {
	try {
		await app?.server.stop()
		await clearBooks(prisma)
	} finally {
		await prisma.$disconnect()
	}
})
function put(uuid: string, field: string, data: Buffer, contentType: string) {
	return request(app.app)
		.put(`/storeBooks/${uuid}/${field}`)
		.set("Authorization", "test-token")
		.set("Content-Type", contentType)
		.set("Content-Disposition", 'attachment; filename="manuscript.pdf"')
		.send(data)
}

describe("real binary uploads", () => {
	it.each(["png", "jpeg"] as const)(
		"decodes a real %s cover and persists its dimensions and blurhash",
		async format => {
			const { book, release } = await seedBook(prisma)
			const data = imageFile(format)
			const response = await put(book.uuid, "cover", data, `image/${format}`)
			expect(response.status).toBe(200)
			expect(response.body.aspectRatio).toBe("1:1.50000")
			expect(response.body.blurhash).toHaveLength(36)
			const saved = await prisma.storeBookCover.findUnique({
				where: { uuid: response.body.uuid }
			})
			expect(saved.blurhash).toBe(response.body.blurhash)
			expect(
				(
					await prisma.storeBookRelease.findUnique({
						where: { id: release.id }
					})
				).coverId
			).toBe(saved.id)
			expect(upload).toHaveBeenCalledWith(
				expect.objectContaining({ data, contentType: `image/${format}` })
			)
		}
	)
	it("parses a real PDF and stores its page count and filename", async () => {
		const { book } = await seedBook(prisma)
		const response = await put(
			book.uuid,
			"printFile",
			pdfFile(32),
			"application/pdf"
		)
		expect(response.status).toBe(200)
		expect(
			await prisma.storeBookPrintFile.findUnique({
				where: { uuid: response.body.uuid }
			})
		).toMatchObject({ pages: 32, fileName: "manuscript.pdf" })
	})
	it.each([
		["cover", "image/png"],
		["printFile", "application/pdf"],
		["printCover", "application/pdf"]
	])("rejects a corrupt %s without writes or upload", async (field, type) => {
		const { book, release } = await seedBook(prisma)
		const response = await put(
			book.uuid,
			field,
			Buffer.from("broken file"),
			type
		)
		expect(response.status).toBe(400)
		expect(response.body.code).toBe("UNEXPECTED_ERROR")
		expect(
			await prisma.storeBookRelease.findUnique({ where: { id: release.id } })
		).toEqual(release)
		expect(create).not.toHaveBeenCalled()
		expect(upload).not.toHaveBeenCalled()
	})
	it.each(["cover", "file", "printCover", "printFile"])(
		"rejects unsupported content type for %s",
		async field => {
			const { book } = await seedBook(prisma)
			expect(
				(await put(book.uuid, field, Buffer.from("text"), "text/plain"))
					.status
			).toBe(415)
			expect(upload).not.toHaveBeenCalled()
		}
	)
	it.each(["cover", "file", "printCover", "printFile"])(
		"returns 404 for an absent book's %s",
		async field => {
			const type = field === "cover" ? "image/png" : "application/pdf"
			const response = await put(
				"missing",
				field,
				Buffer.from("unused"),
				type
			)
			expect(response.status).toBe(404)
			expect(response.body.code).toBe("STORE_BOOK_NOT_EXISTS")
		}
	)
	it("rejects another user's upload before decoding or writing", async () => {
		const { book } = await seedBook(prisma)
		vi.mocked(UsersController.retrieveUser).mockResolvedValue({
			...user,
			id: 43
		} as never)
		expect(
			(await put(book.uuid, "cover", imageFile(), "image/png")).status
		).toBe(403)
		expect(create).not.toHaveBeenCalled()
	})
	it("preserves the published cover when an upload creates a new draft", async () => {
		const { book, release } = await seedBook(prisma, "published", "published")
		expect(
			(await put(book.uuid, "cover", imageFile(), "image/png")).status
		).toBe(200)
		expect(
			await prisma.storeBookRelease.findUnique({ where: { id: release.id } })
		).toEqual(release)
		const draft = await prisma.storeBookRelease.findFirst({
			where: { storeBookId: book.id, status: "unpublished" }
		})
		expect(draft.coverId).not.toBe(release.coverId)
	})
	it.each(["cover", "file", "printCover", "printFile"])(
		"does not attach a failed %s upload",
		async field => {
			const { book, release } = await seedBook(prisma)
			upload.mockResolvedValue({ status: 503 } as never)
			const response = await put(
				book.uuid,
				field,
				field === "cover" ? imageFile() : pdfFile(),
				field === "cover" ? "image/png" : "application/pdf"
			)
			expect(response.status).toBe(400)
			expect(
				await prisma.storeBookRelease.findUnique({
					where: { id: release.id }
				})
			).toEqual(release)
			expect(
				await Promise.all([
					prisma.storeBookCover.count(),
					prisma.storeBookFile.count(),
					prisma.storeBookPrintCover.count(),
					prisma.storeBookPrintFile.count()
				])
			).toEqual([1, 1, 1, 1])
		}
	)
	it("updates the page count when replacing an existing draft PDF", async () => {
		const { book, release } = await seedBook(prisma, "published", "published")
		await prisma.storeBookRelease.create({
			data: {
				uuid: randomUUID(),
				userId: 42n,
				storeBookId: book.id,
				title: "Draft",
				status: "unpublished"
			}
		})
		const first = await put(
			book.uuid,
			"printFile",
			pdfFile(32),
			"application/pdf"
		)
		const second = await put(
			book.uuid,
			"printFile",
			pdfFile(40),
			"application/pdf"
		)
		expect(first.status).toBe(200)
		expect(second.status).toBe(200)
		expect(second.body.uuid).toBe(first.body.uuid)
		expect(
			(
				await prisma.storeBookPrintFile.findUnique({
					where: { uuid: first.body.uuid }
				})
			).pages
		).toBe(40)
		expect(
			(
				await prisma.storeBookRelease.findUnique({
					where: { id: release.id }
				})
			).status
		).toBe("published")
	})
	it.each([false, true])(
		"validates real PDF dimensions at publication (invalid=%s)",
		async invalid => {
			const { release, printFile, printCover } = await seedBook(prisma)
			const interior = new URL(getTableObjectFileUrl(printFile.uuid))
			const cover = new URL(getTableObjectFileUrl(printCover.uuid))
			nock(interior.origin)
				.get(interior.pathname)
				.reply(200, pdfFile(32, invalid ? 595 : 396, invalid ? 842 : 612), {
					"Content-Type": "application/pdf"
				})
			if (!invalid)
				nock(cover.origin)
					.get(cover.pathname)
					.reply(200, pdfFile(1, 11.4 * 72, 8.8 * 72), {
						"Content-Type": "application/pdf"
					})
			const result = await app.server.executeOperation(
				{
					query: `mutation { publishStoreBookRelease(uuid: "${release.uuid}", releaseName: "PDF release") { status } }`
				},
				{ contextValue: { ...dependencies, user: { Id: 42 } as never } }
			)
			if (result.body.kind !== "single")
				throw new Error("Expected single result")
			if (invalid)
				expect(
					result.body.singleResult.errors?.[0].extensions
				).toMatchObject({
					code: "VALIDATION_FAILED",
					errors: ["PRINT_FILE_PAGE_SIZE_INVALID"]
				})
			else expect(result.body.singleResult.errors).toBeUndefined()
		}
	)
})
