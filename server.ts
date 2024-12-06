import { ApolloServer } from "@apollo/server"
import { expressMiddleware } from "@apollo/server/express4"
import { ApolloServerPluginDrainHttpServer } from "@apollo/server/plugin/drainHttpServer"
import { makeExecutableSchema } from "@graphql-tools/schema"
import express from "express"
import http from "http"
import cors from "cors"
import { PrismaClient } from "@prisma/client"
import { createClient } from "redis"
import Stripe from "stripe"
import { Resend } from "resend"
import { Dav, Environment, isSuccessStatusCode } from "dav-js"
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
import { setup as storeBookPrintCoverSetup } from "./src/endpoints/storeBookPrintCover.js"
import { setup as storeBookPrintFileSetup } from "./src/endpoints/storeBookPrintFile.js"
import { setup as davWebhookSetup } from "./src/endpoints/davWebhook.js"
import { setup as luluWebhookSetup } from "./src/endpoints/luluWebhook.js"

const port = process.env.PORT || 4001
const app = express()
const httpServer = http.createServer(app)

export const prisma = new PrismaClient()
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
export const resend = new Resend(process.env.RESEND_API_KEY)

//#region Redis config
export const redis = createClient({
	url: process.env.REDIS_URL,
	database: process.env.ENVIRONMENT == "production" ? 5 : 4 // production: 5, staging: 4
})

redis.on("error", err => console.log("Redis Client Error", err))
await redis.connect()
//#endregion

let schema = makeExecutableSchema({
	typeDefs,
	resolvers
})

schema = authDirectiveTransformer(schema, "auth")

const server = new ApolloServer({
	schema,
	plugins: [ApolloServerPluginDrainHttpServer({ httpServer })],
	introspection: true
})

await server.start()

// Init dav
let environment = Environment.Development

switch (process.env.ENVIRONMENT) {
	case "production":
		environment = Environment.Production
		break
	case "staging":
		environment = Environment.Staging
		break
}

new Dav({
	environment,
	server: true
})

// Call setup function of each endpoint file
publisherLogoSetup(app)
authorProfileImageSetup(app)
storeBookCoverSetup(app)
storeBookFileSetup(app)
storeBookPrintCoverSetup(app)
storeBookPrintFileSetup(app)
davWebhookSetup(app)
luluWebhookSetup(app)

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
				prisma,
				redis,
				resend,
				accessToken,
				user
			}
		}
	})
)

await new Promise<void>(resolve => httpServer.listen({ port }, resolve))
console.log(`🚀 Server ready at http://localhost:${port}/`)

BigInt.prototype["toJSON"] = function () {
	return this.toString()
}
