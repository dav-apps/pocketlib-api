import { ApolloServer } from "@apollo/server"
import { expressMiddleware } from "@apollo/server/express4"
import { ApolloServerPluginDrainHttpServer } from "@apollo/server/plugin/drainHttpServer"
import { makeExecutableSchema } from "@graphql-tools/schema"
import express from "express"
import http from "http"
import cors from "cors"
import { isSuccessStatusCode } from "dav-js"
import { User } from "./src/types.js"
import { throwApiError } from "./src/utils.js"
import { apiErrors } from "./src/errors.js"
import { getUser } from "./src/services/apiService.js"
import { typeDefs } from "./src/typeDefs.js"
import { resolvers } from "./src/resolvers.js"
import { authDirectiveTransformer } from "./src/directives.js"
import { setup as publisherLogoSetup } from "./src/endpoints/publisherLogo.js"
import { setup as authorProfileImageSetup } from "./src/endpoints/authorProfileImage.js"
import { setup as storeBookCoverSetup } from "./src/endpoints/storeBookCover.js"
import { setup as storeBookFileSetup } from "./src/endpoints/storeBookFile.js"

const port = process.env.PORT || 4000
const app = express()
const httpServer = http.createServer(app)

let schema = makeExecutableSchema({
	typeDefs,
	resolvers
})

schema = authDirectiveTransformer(schema, "auth")

const server = new ApolloServer({
	schema,
	plugins: [ApolloServerPluginDrainHttpServer({ httpServer })]
})

await server.start()

// Call setup function of each endpoint file
publisherLogoSetup(app)
authorProfileImageSetup(app)
storeBookCoverSetup(app)
storeBookFileSetup(app)

app.use(
	"/",
	cors<cors.CorsRequest>(),
	express.json({ type: "application/json", limit: "50mb" }),
	expressMiddleware(server, {
		context: async ({ req }) => {
			const accessToken = req.headers.authorization
			let user: User = null

			if (accessToken != null) {
				let userResponse = await getUser(accessToken)

				if (isSuccessStatusCode(userResponse.status)) {
					user = userResponse.data
				} else if (
					userResponse.errors != null &&
					userResponse.errors.length > 0 &&
					userResponse.errors[0].code == 3101
				) {
					throwApiError(apiErrors.sessionEnded)
				}
			}

			return {
				accessToken,
				user
			}
		}
	})
)

await new Promise<void>(resolve => httpServer.listen({ port }, resolve))
console.log(`🚀 Server ready at http://localhost:${port}/`)
