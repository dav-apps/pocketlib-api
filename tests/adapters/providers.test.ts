import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import nock from "nock"
import https from "node:https"
import { UsersController, type ShippingAddressResource } from "dav-js"
import * as vlb from "../../src/services/vlbApiService.js"
import * as lulu from "../../src/services/luluApiService.js"
import * as files from "../../src/services/fileService.js"

beforeEach(() => {
	vi.stubEnv("VLB_METADATA_TOKEN", "test-vlb-token")
	vi.stubEnv("LULU_AUTH_KEY", "test-lulu-basic")
	vi.spyOn(console, "error").mockImplementation(() => {})
	vi.spyOn(console, "log").mockImplementation(() => {})
})
afterEach(() => vi.unstubAllEnvs())

describe("VLB HTTP adapter", () => {
	it("maps filters, pagination and authorization to a product request", async () => {
		const response = { content: [], totalElements: 0, totalPages: 0 }
		const scope = nock("https://api.vlb.de", {
			reqheaders: { authorization: "Bearer test-vlb-token" }
		})
			.get("/api/v2/products")
			.query({
				search: "Autor & Titel",
				page: 2,
				size: 5,
				active: true,
				sort: "publicationDate"
			})
			.reply(200, response)
		expect(
			await vlb.getProducts({
				query: "Autor & Titel",
				page: 2,
				size: 5,
				active: true,
				sort: "publicationDate"
			})
		).toEqual(response)
		expect(scope.isDone()).toBe(true)
	})
	it("requests the short product representation", async () => {
		const product = {
			productId: "123",
			titles: [{ title: "Example", titleType: "01" }]
		}
		const scope = nock("https://api.vlb.de", {
			reqheaders: { "content-type": "application/json-short" }
		})
			.get("/api/v2/product/123")
			.reply(200, product)
		expect(await vlb.getProduct("123")).toEqual(product)
		expect(scope.isDone()).toBe(true)
	})
	it("uses default pagination for collections", async () => {
		const scope = nock("https://api.vlb.de")
			.get("/api/v2/collections/collection/c1")
			.query({ page: 1, size: 10 })
			.reply(200, { content: [], totalElements: 0 })
		expect(await vlb.getCollection({ collectionId: "c1" })).toMatchObject({
			content: []
		})
		expect(scope.isDone()).toBe(true)
	})
	it.each([401, 404, 429, 503])(
		"returns null for provider status %i",
		async status => {
			const scope = nock("https://api.vlb.de")
				.get("/api/v2/product/missing")
				.reply(status, { error: "Unavailable" })
			expect(await vlb.getProduct("missing")).toBeNull()
			expect(scope.isDone()).toBe(true)
		}
	)
	it("returns null on transport failure", async () => {
		const scope = nock("https://api.vlb.de")
			.get("/api/v2/publisher/p1")
			.replyWithError(new Error("Connection reset"))
		expect(await vlb.getPublisher("p1")).toBeNull()
		expect(scope.isDone()).toBe(true)
	})
})

describe("Lulu HTTP adapter", () => {
	it("authenticates with the sandbox and client credentials", async () => {
		const scope = nock("https://api.sandbox.lulu.com", {
			reqheaders: { authorization: "Basic test-lulu-basic" }
		})
			.post(
				"/auth/realms/glasstree/protocol/openid-connect/token",
				"grant_type=client_credentials"
			)
			.reply(200, { access_token: "access" })
		expect(await lulu.authenticate()).toMatchObject({
			access_token: "access"
		})
		expect(scope.isDone()).toBe(true)
	})
	it("maps the shipping address and page count for a cost calculation", async () => {
		const scope = nock("https://api.sandbox.lulu.com", {
			reqheaders: { authorization: "Bearer access" }
		})
			.post("/print-job-cost-calculations", body => {
				expect(body.line_items[0]).toMatchObject({
					page_count: 32,
					quantity: 1
				})
				expect(body.shipping_address).toMatchObject({
					country_code: "DE",
					postcode: "10115",
					street1: "Street 1",
					phone_number: "123"
				})
				return true
			})
			.reply(200, { total_cost_incl_tax: "12.34" })
		expect(
			await lulu.createPrintJobCostCalculation("access", {
				pageCount: 32,
				shippingAddress: {
					country: "DE",
					postalCode: "10115",
					line1: "Street 1",
					phone: "123"
				} as ShippingAddressResource
			})
		).toEqual({ total_cost_incl_tax: "12.34" })
		expect(scope.isDone()).toBe(true)
	})
	it("selects the production endpoint only in production", async () => {
		vi.stubEnv("ENV", "production")
		const scope = nock("https://api.lulu.com")
			.post("/auth/realms/glasstree/protocol/openid-connect/token")
			.reply(401)
		expect(await lulu.authenticate()).toBeNull()
		expect(scope.isDone()).toBe(true)
	})
})

describe("S3 file adapter", () => {
	beforeEach(() => {
		// Nock does not complete S3's Expect: 100-continue handshake. Simulate
		// just that interim response; Nock still checks the actual SDK request.
		const original = https.request
		vi.spyOn(https, "request").mockImplementation(((
			...args: Parameters<typeof https.request>
		) => {
			const req = original(...args)
			if (req.getHeader("expect") === "100-continue")
				process.nextTick(() => req.emit("continue"))
			return req
		}) as typeof https.request)
	})
	it("checks existence using HEAD", async () => {
		const scope = nock("https://pocketlib.fra1.digitaloceanspaces.com")
			.head("/test-cover.png")
			.reply(200)
		expect(await files.check("test-cover.png")).toBe(true)
		expect(scope.isDone()).toBe(true)
	})
	it("reports missing files", async () => {
		const scope = nock("https://pocketlib.fra1.digitaloceanspaces.com")
			.head("/missing")
			.reply(404)
		expect(await files.check("missing")).toBe(false)
		expect(scope.isDone()).toBe(true)
	})
	it("uploads with content type and returns the CDN link", async () => {
		const scope = nock("https://pocketlib.fra1.digitaloceanspaces.com", {
			reqheaders: { "content-type": "image/png", "x-amz-acl": "public-read" }
		})
			.put("/test-cover.png")
			.query(true)
			.reply(200, "", { ETag: '"test"' })
		expect(
			await files.upload("test-cover.png", Buffer.from("test"), "image/png")
		).toBe("https://pocketlib.fra1.cdn.digitaloceanspaces.com/test-cover.png")
		expect(scope.isDone()).toBe(true)
	})
	it("returns null when storage rejects an upload", async () => {
		const scope = nock("https://pocketlib.fra1.digitaloceanspaces.com")
			.put("/rejected")
			.query(true)
			.reply(403, "Access denied")
		expect(await files.upload("rejected", Buffer.from("test"))).toBeNull()
		expect(scope.isDone()).toBe(true)
	})
})

describe("DAV SDK boundary", () => {
	it("passes a token and parses a real GraphQL response", async () => {
		const scope = nock("http://localhost:4000", {
			reqheaders: { authorization: "test-token" }
		})
			.post("/", body => {
				expect(body.query).toContain("retrieveUser")
				return true
			})
			.reply(200, { data: { retrieveUser: { id: 42 } } })
		expect(
			await UsersController.retrieveUser("id", { accessToken: "test-token" })
		).toEqual({ id: 42 })
		expect(scope.isDone()).toBe(true)
	})
	it("maps GraphQL session errors to the SDK error response", async () => {
		const scope = nock("http://localhost:4000")
			.post("/")
			.reply(200, {
				errors: [
					{ message: "Expired", extensions: { code: "SESSION_EXPIRED" } }
				]
			})
		expect(
			await UsersController.retrieveUser("id", { accessToken: "expired" })
		).toContain("SESSION_EXPIRED")
		expect(scope.isDone()).toBe(true)
	})
})
