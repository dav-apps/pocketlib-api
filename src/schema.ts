import { makeExecutableSchema } from "@graphql-tools/schema"
import { typeDefs } from "./typeDefs.js"
import { resolvers } from "./resolvers.js"
import { authDirectiveTransformer } from "./directives.js"

export function createSchema() {
	return authDirectiveTransformer(
		makeExecutableSchema({ typeDefs, resolvers }),
		"auth"
	)
}
