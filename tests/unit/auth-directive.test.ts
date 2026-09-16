import { afterEach, describe, expect, it, vi } from "vitest"
import { ApolloServer } from "@apollo/server"
import { makeExecutableSchema } from "@graphql-tools/schema"
import { TableObjectsController } from "dav-js"
import { authDirectiveTransformer } from "../../src/directives.js"
import { admins } from "../../src/constants.js"

vi.mock("dav-js", async importOriginal => {
	const actual = await importOriginal<typeof import("dav-js")>()
	return {
		...actual,
		TableObjectsController: {
			...actual.TableObjectsController,
			retrieveTableObject: vi.fn()
		}
	}
})

const servers: ApolloServer[] = []
afterEach(async () => {
	await Promise.all(servers.splice(0).map(server => server.stop()))
})

describe("auth directive through GraphQL", () => {
	it.each([
		["USER", null, null, "NOT_AUTHENTICATED"],
		["USER", 42, null, null],
		["ADMIN", null, null, "NOT_AUTHENTICATED"],
		["ADMIN", 42, null, "ACTION_NOT_ALLOWED"],
		["ADMIN", admins[0], null, null],
		["AUTHOR", null, null, "NOT_AUTHENTICATED"],
		["AUTHOR", 42, 42, null],
		["AUTHOR", 42, 43, "ACTION_NOT_ALLOWED"],
		["AUTHOR", 42, "error", "ACTION_NOT_ALLOWED"],
		["AUTHOR", admins[0], 43, null]
	] as const)(
		"role %s, user %s, owner %s => %s",
		async (role, userId, owner, errorCode) => {
			const retrieve = vi
				.mocked(TableObjectsController.retrieveTableObject)
				.mockReset()
			retrieve.mockResolvedValue(
				owner === "error"
					? ["SESSION_EXPIRED"]
					: ({ user: { id: owner } } as never)
			)
			const protectedResolver = vi.fn(() => "private")
			const schema = makeExecutableSchema({
				typeDefs: `
				directive @auth(role: String) on FIELD_DEFINITION
				type Query { book: Book! }
				type Book { secret: String @auth(role: "${role}") }
			`,
				resolvers: {
					Query: { book: () => ({ uuid: "book-uuid" }) },
					Book: { secret: protectedResolver }
				}
			})
			const server = new ApolloServer({
				schema: authDirectiveTransformer(schema, "auth")
			})
			servers.push(server)
			const result = await server.executeOperation(
				{ query: "{ book { secret } }" },
				{
					contextValue: { user: userId === null ? null : { Id: userId } }
				}
			)
			if (result.body.kind !== "single")
				throw new Error("Expected a single GraphQL response")
			const response = result.body.singleResult
			if (errorCode) {
				expect(response.errors?.[0].extensions.code).toBe(errorCode)
				expect(response.data).toEqual({ book: { secret: null } })
				expect(protectedResolver).not.toHaveBeenCalled()
			} else {
				expect(response.errors).toBeUndefined()
				expect(response.data).toEqual({ book: { secret: "private" } })
				expect(protectedResolver).toHaveBeenCalledOnce()
			}
			if (role === "AUTHOR" && userId !== null && userId !== admins[0]) {
				expect(retrieve).toHaveBeenCalledWith(expect.any(String), {
					uuid: "book-uuid"
				})
			} else {
				expect(retrieve).not.toHaveBeenCalled()
			}
		}
	)
})
