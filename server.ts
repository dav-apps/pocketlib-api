import { ApolloServer } from "@apollo/server"
import { startStandaloneServer } from "@apollo/server/standalone"
import { typeDefs } from "./src/typeDefs.js"
import { resolvers } from "./src/resolvers.js"

const server = new ApolloServer({
	typeDefs,
	resolvers
})

const { url } = await startStandaloneServer(server)
console.log(`🚀 Server ready at ${url}`)
