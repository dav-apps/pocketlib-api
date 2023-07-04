import { ApolloServer } from "@apollo/server"
import { startStandaloneServer } from "@apollo/server/standalone"

// The GraphQL schema
const typeDefs = `#graphql
  type Query {
    allPublishers: [Publisher]
    allAuthors: [Author]
  }
  type Publisher {
    name: String
    description: String
    authors: [Author]
  }
  type Author {
    firstName: String
    lastName: String
  }
`

// A map of functions which return data for the schema.
const resolvers = {
	Query: {
		allPublishers: () => {
			return [
				{
					name: "StandardEbooks",
					description: "Hello World"
				}
			]
		},
		allAuthors: () => {
			return [
				{
					firstName: "Lemony",
					lastName: "Snicket"
				}
			]
		}
	},
	Publisher: {
		authors: () => {
			return [
				{
					firstName: "George",
					lastName: "Orwell"
				}
			]
		}
	}
}

const server = new ApolloServer({
	typeDefs,
	resolvers
})

const { url } = await startStandaloneServer(server)
console.log(`🚀 Server ready at ${url}`)
