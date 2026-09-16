import { ApolloServer } from "@apollo/server"
import { expressMiddleware } from "@apollo/server/express4"
import { ApolloServerPluginDrainHttpServer } from "@apollo/server/plugin/drainHttpServer"
import express from "express"
import http from "node:http"
import cors from "cors"
import { User, UsersController, convertUserResourceToUser } from "dav-js"
import { throwApiError } from "./utils.js"
import { apiErrors } from "./errors.js"
import { createSchema } from "./schema.js"
import type { AppDependencies } from "./appDependencies.js"
import type { ResolverContext } from "./types.js"
import { setup as publisherLogoSetup } from "./endpoints/publisherLogo.js"
import { setup as authorProfileImageSetup } from "./endpoints/authorProfileImage.js"
import { setup as storeBookCoverSetup } from "./endpoints/storeBookCover.js"
import { setup as storeBookFileSetup } from "./endpoints/storeBookFile.js"
import { setup as storeBookPrintCoverSetup } from "./endpoints/storeBookPrintCover.js"
import { setup as storeBookPrintFileSetup } from "./endpoints/storeBookPrintFile.js"
import { setup as davWebhookSetup } from "./endpoints/davWebhook.js"
import { setup as luluWebhookSetup } from "./endpoints/luluWebhook.js"

// Creates the application without opening connections or listening on a port.
// The caller owns the injected clients and must close them after server.stop().
export async function createApp(dependencies: AppDependencies) {
	BigInt.prototype["toJSON"] = function () {
		return this.toString()
	}

	const app = express()
	const httpServer = http.createServer(app)
	const server = new ApolloServer<ResolverContext>({
		schema: createSchema(),
		plugins: [ApolloServerPluginDrainHttpServer({ httpServer })],
		introspection: true
	})
	await server.start()

	publisherLogoSetup(app, dependencies)
	authorProfileImageSetup(app, dependencies)
	storeBookCoverSetup(app, dependencies)
	storeBookFileSetup(app, dependencies)
	storeBookPrintCoverSetup(app, dependencies)
	storeBookPrintFileSetup(app, dependencies)
	davWebhookSetup(app, dependencies)
	luluWebhookSetup(app, dependencies)

	app.use(
		"/",
		cors<cors.CorsRequest>(),
		express.json({ type: "application/json", limit: "50mb" }),
		expressMiddleware(server, {
			context: async ({ req }) => {
				const accessToken = req.headers.authorization
				let user: User = null

				if (accessToken != null) {
					let userResponse = await UsersController.retrieveUser(
						`
						id
						email
						firstName
						plan
					`,
						{ accessToken }
					)

					if (!Array.isArray(userResponse)) {
						user = convertUserResourceToUser(userResponse)
					} else {
						throwApiError(apiErrors.sessionExpired)
					}
				}

				return {
					prisma: dependencies.prisma,
					redis: dependencies.redis,
					resend: dependencies.resend,
					accessToken,
					user
				}
			}
		})
	)
	return { app, server, httpServer }
}
