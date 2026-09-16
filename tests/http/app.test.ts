import { afterEach, describe, expect, it, vi } from "vitest"
import request from "supertest"
import { Plan, UsersController } from "dav-js"
import { createApp } from "../../src/app.js"
import { testDependencies } from "../helpers/dependencies.js"

vi.mock("dav-js", async importOriginal => {
	const actual = await importOriginal<typeof import("dav-js")>()
	return {
		...actual,
		UsersController: { ...actual.UsersController, retrieveUser: vi.fn() }
	}
})

const apps: Awaited<ReturnType<typeof createApp>>[] = []
afterEach(async () => {
	await Promise.all(apps.splice(0).map(app => app.server.stop()))
})

async function setup() {
	const dependencies = testDependencies()
	const application = await createApp(dependencies)
	apps.push(application)
	return { ...application, dependencies }
}

describe("application HTTP boundary", () => {
	it("creates a working GraphQL app without opening a listener", async () => {
		const { app, httpServer } = await setup()
		expect(httpServer.listening).toBe(false)
		const response = await request(app)
			.post("/")
			.send({ query: "{ __typename }" })
		expect(response.status).toBe(200)
		expect(response.body).toEqual({ data: { __typename: "Query" } })
	})
	it.each([
		'{ retrievePublisher(uuid: "mine") { uuid } }',
		'mutation { createPublisher(name: "Test publisher") { uuid } }'
	])("rejects anonymous access without database effects: %s", async query => {
		const { app, dependencies } = await setup()
		const response = await request(app).post("/").send({ query })
		expect(response.status).toBe(200)
		expect(response.body.errors[0].extensions.code).toBe("NOT_AUTHENTICATED")
		expect(dependencies.prisma.publisher.findFirst).not.toHaveBeenCalled()
		expect(dependencies.prisma.publisher.create).not.toHaveBeenCalled()
	})
	it("passes the authorization header to DAV and reports expired sessions", async () => {
		const retrieve = vi
			.mocked(UsersController.retrieveUser)
			.mockReset()
			.mockResolvedValue(["SESSION_EXPIRED"])
		const { app, dependencies } = await setup()
		const response = await request(app)
			.post("/")
			.set("Authorization", "expired-token")
			.send({ query: '{ retrievePublisher(uuid: "mine") { uuid } }' })
		expect(response.body.errors[0].extensions.code).toBe("SESSION_EXPIRED")
		expect(retrieve).toHaveBeenCalledWith(expect.any(String), {
			accessToken: "expired-token"
		})
		expect(dependencies.prisma.publisher.findFirst).not.toHaveBeenCalled()
	})
	it("builds the resolver context from the authenticated DAV user", async () => {
		vi.mocked(UsersController.retrieveUser).mockReset().mockResolvedValue({
			id: 42,
			email: "reader@example.test",
			firstName: "Reader",
			confirmed: true,
			totalStorage: 0,
			usedStorage: 0,
			stripeCustomerId: null,
			plan: Plan.Free,
			subscriptionStatus: null,
			periodEnd: null,
			dev: null,
			provider: null,
			profileImage: null,
			apps: { total: 0, items: [] }
		})
		const { app, dependencies } = await setup()
		vi.mocked(dependencies.prisma.publisher.findFirst).mockResolvedValue({
			id: 1n,
			userId: 42n,
			uuid: "publisher-uuid",
			slug: "test-publisher",
			name: "Test publisher",
			description: null,
			websiteUrl: null,
			facebookUsername: null,
			instagramUsername: null,
			twitterUsername: null,
			createdAt: new Date("2026-01-01"),
			updatedAt: new Date("2026-01-01")
		})
		const response = await request(app)
			.post("/")
			.set("Authorization", "valid-token")
			.send({ query: '{ retrievePublisher(uuid: "mine") { uuid name } }' })
		expect(response.status).toBe(200)
		expect(response.body).toEqual({
			data: {
				retrievePublisher: {
					uuid: "publisher-uuid",
					name: "Test publisher"
				}
			}
		})
		expect(dependencies.prisma.publisher.findFirst).toHaveBeenCalledWith({
			where: { userId: 42 }
		})
	})
	it("registers upload routes and rejects an anonymous binary upload", async () => {
		const { app, dependencies } = await setup()
		const response = await request(app)
			.put("/publishers/mine/logo")
			.set("Content-Type", "image/png")
			.send(Buffer.from("test"))
		expect(response.status).toBe(401)
		expect(response.body.code).toBe("NOT_AUTHENTICATED")
		expect(dependencies.prisma.publisher.findFirst).not.toHaveBeenCalled()
	})
	it("uses the injected webhook key independently for each app", async () => {
		const first = await setup()
		const second = await createApp({
			...testDependencies(),
			webhookKey: "second-key"
		})
		apps.push(second)
		const payload = { type: "test.ignored" }
		expect(
			(
				await request(first.app)
					.post("/webhooks/dav")
					.set("Authorization", "test-webhook-key")
					.send(payload)
			).status
		).toBe(200)
		expect(
			(
				await request(second.app)
					.post("/webhooks/dav")
					.set("Authorization", "test-webhook-key")
					.send(payload)
			).status
		).toBe(400)
		expect(
			(
				await request(second.app)
					.post("/webhooks/dav")
					.set("Authorization", "second-key")
					.send(payload)
			).status
		).toBe(200)
	})
})
