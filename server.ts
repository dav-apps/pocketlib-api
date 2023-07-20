import { ApolloServer } from "@apollo/server"
import { startStandaloneServer } from "@apollo/server/standalone"
import { defaultFieldResolver } from "graphql"
import { makeExecutableSchema } from "@graphql-tools/schema"
import { mapSchema, getDirective, MapperKind } from "@graphql-tools/utils"
import { User } from "./src/types.js"
import { admins } from "./src/constants.js"
import { getUser, getTableObject } from "./src/services/apiService.js"
import { typeDefs } from "./src/typeDefs.js"
import { resolvers } from "./src/resolvers.js"

const authDirectiveTransformer = (schema, directiveName) => {
	return mapSchema(schema, {
		[MapperKind.OBJECT_FIELD]: fieldConfig => {
			const authDirective = getDirective(schema, fieldConfig, directiveName)

			if (authDirective) {
				const { resolve = defaultFieldResolver } = fieldConfig
				const { role } = authDirective[0]

				fieldConfig.resolve = async (parent, args, context, info) => {
					const user: User = context.user
					const userRole = role == "USER"
					const authorRole = role == "AUTHOR"
					const adminRole = role == "ADMIN"

					if (user == null && (userRole || authorRole || adminRole)) {
						throw new Error("You are not authenticated")
					}

					if (user != null && adminRole && !admins.includes(user.id)) {
						throw new Error("Action not allowed")
					}

					if (user != null && authorRole && !admins.includes(user.id)) {
						let throwError = false

						// Get the parent table object
						let tableObject = await getTableObject(parent.uuid)

						if (tableObject == null) {
							throwError = true
						}

						if (tableObject != null) {
							// Check if the table object belongs to the user
							if (user.id != tableObject.userId) {
								throwError = true
							}
						}

						if (throwError) {
							throw new Error("Action not allowed")
						}
					}

					return await resolve(parent, args, context, info)
				}

				return fieldConfig
			}
		}
	})
}

let schema = makeExecutableSchema({
	typeDefs,
	resolvers
})

schema = authDirectiveTransformer(schema, "auth")

const server = new ApolloServer({
	schema
})

const { url } = await startStandaloneServer(server, {
	context: async ({ req }) => {
		const token = req.headers.authorization
		let user: User = null

		if (token) {
			user = await getUser(token)
		}

		return {
			token,
			user
		}
	}
})

console.log(`🚀 Server ready at ${url}`)
