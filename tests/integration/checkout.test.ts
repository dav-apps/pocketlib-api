import {
	afterAll,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	vi
} from "vitest"
import { PrismaClient } from "@prisma/client"
import {
	CheckoutSessionsController,
	ShippingAddressesController,
	TableObjectsController,
	Plan,
	type User
} from "dav-js"
import * as lulu from "../../src/services/luluApiService.js"
import * as vlb from "../../src/services/vlbApiService.js"
import * as files from "../../src/services/fileService.js"
import { createApp } from "../../src/app.js"
import { testDependencies } from "../helpers/dependencies.js"
import { clearBooks, seedBook } from "../helpers/books.js"
import { getTestDatabaseUrl } from "../../scripts/test-database.mjs"

vi.mock("dav-js", async importOriginal => {
	const actual = await importOriginal<typeof import("dav-js")>()
	return {
		...actual,
		CheckoutSessionsController: { createPaymentCheckoutSession: vi.fn() },
		ShippingAddressesController: { listShippingAddresses: vi.fn() },
		TableObjectsController: {
			...actual.TableObjectsController,
			retrieveTableObject: vi.fn(),
			createTableObject: vi.fn()
		}
	}
})
vi.mock("../../src/services/luluApiService.js", () => ({
	authenticate: vi.fn(),
	createPrintJobCostCalculation: vi.fn()
}))
vi.mock("../../src/services/vlbApiService.js", () => ({ getProduct: vi.fn() }))
vi.mock("../../src/services/fileService.js", () => ({
	check: vi.fn(),
	upload: vi.fn(),
	getFileLink: (key: string) => `https://files.example.test/${key}`
}))

const prisma = new PrismaClient({
	datasources: { db: { url: getTestDatabaseUrl() } }
})
const dependencies = { ...testDependencies(), prisma }
let app: Awaited<ReturnType<typeof createApp>>
const checkout = vi.mocked(
	CheckoutSessionsController.createPaymentCheckoutSession
)
const addresses = vi.mocked(ShippingAddressesController.listShippingAddresses)
const product = {
	titles: [{ titleType: "01", title: "VLB title" }],
	prices: [{ priceType: "02", countriesIncluded: "DE", priceAmount: 19.99 }],
	supportingResources: []
}

beforeAll(async () => {
	app = await createApp(dependencies)
})
beforeEach(async () => {
	vi.resetAllMocks()
	await clearBooks(prisma)
	await prisma.vlbItem.deleteMany()
	checkout.mockResolvedValue({ url: "https://checkout.example.test/session" })
	addresses.mockResolvedValue({
		total: 1,
		items: [
			{
				name: "Test buyer",
				country: "DE",
				city: "Berlin",
				postalCode: "10115",
				line1: "Test street"
			}
		]
	} as never)
	vi.mocked(lulu.authenticate).mockResolvedValue({
		access_token: "lulu-token"
	} as never)
	vi.mocked(lulu.createPrintJobCostCalculation).mockResolvedValue({
		total_cost_incl_tax: "19.99"
	})
	vi.mocked(vlb.getProduct).mockResolvedValue(
		structuredClone(product) as never
	)
	vi.mocked(files.check).mockResolvedValue(true)
	vi.mocked(TableObjectsController.retrieveTableObject).mockResolvedValue({
		uuid: "vlb-item"
	} as never)
	vi.mocked(TableObjectsController.createTableObject).mockResolvedValue({
		uuid: "vlb-item"
	} as never)
})
afterAll(async () => {
	try {
		await app?.server.stop()
		await clearBooks(prisma)
		await prisma.vlbItem.deleteMany()
	} finally {
		await prisma.$disconnect()
	}
})

async function execute(
	kind: "StoreBook" | "VlbItem",
	uuid: string,
	userId: number | null = 42,
	plan = Plan.Free
) {
	const query = `mutation { createCheckoutSessionFor${kind}(${kind === "StoreBook" ? "storeBookUuid" : "uuid"}: "${uuid}", successUrl: "https://example.test/success", cancelUrl: "https://example.test/cancel") { url } }`
	const result = await app.server.executeOperation(
		{ query },
		{
			contextValue: {
				...dependencies,
				accessToken: "test-token",
				user: userId == null ? null : ({ Id: userId, Plan: plan } as User)
			}
		}
	)
	if (result.body.kind !== "single") throw new Error("Expected single result")
	return result.body.singleResult
}
async function seedVlb() {
	return prisma.vlbItem.create({
		data: { uuid: "vlb-item", title: "VLB title", mvbId: "mvb-item" }
	})
}
function expectRejected(
	result: Awaited<ReturnType<typeof execute>>,
	code = "UNEXPECTED_ERROR"
) {
	expect(result.errors?.[0].extensions.code).toBe(code)
	expect(checkout).not.toHaveBeenCalled()
}

describe("checkout", () => {
	it.each(["StoreBook", "VlbItem"] as const)(
		"requires authentication for %s",
		async kind => {
			expectRejected(
				await execute(kind, "missing", null),
				"NOT_AUTHENTICATED"
			)
		}
	)
	it.each([
		["StoreBook", "STORE_BOOK_NOT_EXISTS"],
		["VlbItem", "VLB_ITEM_NOT_EXISTS"]
	] as const)("rejects missing %s", async (kind, code) => {
		expectRejected(await execute(kind, "missing"), code)
	})
	it("buyers use the published release and the registered DAV price", async () => {
		const { book, release } = await seedBook(prisma, "published", "published")
		await prisma.storeBookRelease.create({
			data: {
				uuid: "draft-release",
				userId: 42n,
				storeBookId: book.id,
				title: "Draft",
				status: "unpublished"
			}
		})
		const result = await execute("StoreBook", book.uuid, 43)
		expect(result.errors).toBeUndefined()
		expect(checkout).toHaveBeenCalledWith(
			"url",
			expect.objectContaining({
				productName: release.title,
				price: null,
				currency: "EUR",
				tableObjectUuid: book.uuid,
				accessToken: "test-token"
			})
		)
		expect(lulu.authenticate).not.toHaveBeenCalled()
	})
	it("does not sell a draft when no published release exists", async () => {
		const { book } = await seedBook(prisma, "unpublished")
		expectRejected(
			await execute("StoreBook", book.uuid, 43),
			"STORE_BOOK_RELEASE_NOT_EXISTS"
		)
	})
	it("charges authors rounded printing cost in integer cents", async () => {
		const { book } = await seedBook(prisma)
		expect((await execute("StoreBook", book.uuid)).errors).toBeUndefined()
		expect(checkout).toHaveBeenCalledWith(
			"url",
			expect.objectContaining({
				price: 1999,
				type: "ORDER",
				currency: "EUR"
			})
		)
		expect(lulu.createPrintJobCostCalculation).toHaveBeenCalledWith(
			"lulu-token",
			expect.objectContaining({
				pageCount: 100,
				shippingAddress: expect.objectContaining({ city: "Berlin" })
			})
		)
	})
	it.each(["", "not-a-price", "-1", "Infinity"])(
		"rejects invalid printing cost %s",
		async amount => {
			const { book } = await seedBook(prisma)
			vi.mocked(lulu.createPrintJobCostCalculation).mockResolvedValue({
				total_cost_incl_tax: amount
			})
			expectRejected(await execute("StoreBook", book.uuid))
		}
	)
	it("uses the configured fallback address when the author's list is empty", async () => {
		const { book } = await seedBook(prisma)
		addresses.mockResolvedValueOnce({ total: 0, items: [] })
		expect((await execute("StoreBook", book.uuid)).errors).toBeUndefined()
		expect(addresses).toHaveBeenLastCalledWith(
			expect.any(String),
			expect.objectContaining({ userId: 1, limit: 1 })
		)
	})
	it("rejects missing addresses before contacting Lulu", async () => {
		const { book } = await seedBook(prisma)
		addresses.mockResolvedValue({ total: 0, items: [] })
		expectRejected(await execute("StoreBook", book.uuid))
		expect(lulu.authenticate).not.toHaveBeenCalled()
	})
	it.each(["auth", "cost"])(
		"handles a failed Lulu %s response",
		async operation => {
			const { book } = await seedBook(prisma)
			if (operation === "auth")
				vi.mocked(lulu.authenticate).mockResolvedValue(null)
			else
				vi.mocked(lulu.createPrintJobCostCalculation).mockResolvedValue(
					null
				)
			expectRejected(await execute("StoreBook", book.uuid))
		}
	)
	it.each(["release", "cover", "printFile"])(
		"rejects missing %s instead of dereferencing null",
		async field => {
			const { book, release } = await seedBook(prisma)
			if (field === "release")
				await prisma.storeBookRelease.delete({ where: { id: release.id } })
			else
				await prisma.storeBookRelease.update({
					where: { id: release.id },
					data: { [field + "Id"]: null }
				})
			expectRejected(
				await execute("StoreBook", book.uuid),
				field === "release"
					? "STORE_BOOK_RELEASE_NOT_EXISTS"
					: "UNEXPECTED_ERROR"
			)
		}
	)
	it.each([
		[Plan.Free, 450],
		[Plan.Plus, 450],
		[Plan.Pro, null]
	] as const)("VLB shipping for %s costs %s", async (plan, shipping) => {
		await seedVlb()
		expect(
			(await execute("VlbItem", "vlb-item", 42, plan)).errors
		).toBeUndefined()
		expect(checkout).toHaveBeenCalledWith(
			"url",
			expect.objectContaining({
				price: 1999,
				shippingRate:
					shipping == null
						? null
						: { name: "Standard-Versand", price: shipping }
			})
		)
	})
	it.each(["titles", "prices"])(
		"rejects missing VLB %s before creating remote objects",
		async field => {
			await seedVlb()
			vi.mocked(vlb.getProduct).mockResolvedValue({
				...product,
				[field]: []
			} as never)
			expectRejected(await execute("VlbItem", "vlb-item"))
			expect(TableObjectsController.createTableObject).not.toHaveBeenCalled()
			expect(files.check).not.toHaveBeenCalled()
		}
	)
	it("rejects unavailable VLB products", async () => {
		await seedVlb()
		vi.mocked(vlb.getProduct).mockResolvedValue(null)
		expectRejected(
			await execute("VlbItem", "vlb-item"),
			"VLB_ITEM_NOT_EXISTS"
		)
	})
	it("creates the DAV item only if absent", async () => {
		await seedVlb()
		vi.mocked(TableObjectsController.retrieveTableObject).mockResolvedValue(
			null
		)
		expect((await execute("VlbItem", "vlb-item")).errors).toBeUndefined()
		expect(TableObjectsController.createTableObject).toHaveBeenCalledOnce()
	})
	it("does not start checkout after DAV item creation fails", async () => {
		await seedVlb()
		vi.mocked(TableObjectsController.retrieveTableObject).mockResolvedValue(
			null
		)
		vi.mocked(TableObjectsController.createTableObject).mockResolvedValue([
			"SESSION_EXPIRED"
		])
		expectRejected(await execute("VlbItem", "vlb-item"))
	})
	it.each(["StoreBook", "VlbItem"] as const)(
		"reports checkout provider errors for %s",
		async kind => {
			const uuid =
				kind === "StoreBook"
					? (await seedBook(prisma)).book.uuid
					: (await seedVlb()).uuid
			checkout.mockResolvedValue(["SESSION_EXPIRED"])
			const result = await execute(kind, uuid)
			expect(result.errors?.[0].extensions.code).toBe("UNEXPECTED_ERROR")
			expect(result.data?.[`createCheckoutSessionFor${kind}`]).toBeNull()
		}
	)
})
