import { ApolloServer } from "@apollo/server"
import { startStandaloneServer } from "@apollo/server/standalone"
import axios from "axios"

// The GraphQL schema
const typeDefs = `#graphql
  type Query {
    allPublishers: [Publisher]
    allAuthors: [Author]
  }
  type Publisher {
    uuid: String!
    name: String
    description: String
    authors: [Author]
  }
  type Author {
    uuid: String!
    firstName: String
    lastName: String
  }
`

// A map of functions which return data for the schema.
const resolvers = {
	Query: {
		allPublishers: async () => {
			try {
				let response = await axios({
					method: "get",
					url: "http://localhost:3111/v2/table_objects",
					params: {
						table_id: 33
					}
				})

				let result = []

				for (let obj of response.data.table_objects) {
					result.push({
						uuid: obj.uuid,
						name: obj.properties.name,
						description: obj.properties.description,
						authors: obj.properties.authors
					})
				}

				return result
			} catch (error) {
				console.error(error.response.data)
				return []
			}
		},
		allAuthors: () => {
			return [
				{
					uuid: "weqweqweqwe",
					firstName: "Lemony",
					lastName: "Snicket"
				}
			]
		}
	},
	Publisher: {
		authors: async publisher => {
			if (publisher.authors == null) {
				return []
			}

			let authorUuids = publisher.authors.split(",")
			let authors = []

			for (let uuid of authorUuids) {
				try {
					let response = await axios({
						method: "get",
						url: `http://localhost:3111/v2/table_objects/${uuid}`
					})

					authors.push({
						uuid: response.data.uuid,
						firstName: response.data.properties.first_name,
						lastName: response.data.properties.last_name
					})
				} catch (error) {
					console.error(error.response.data)
				}
			}

			return authors
		}
	}
}

const server = new ApolloServer({
	typeDefs,
	resolvers
})

const { url } = await startStandaloneServer(server)
console.log(`🚀 Server ready at ${url}`)
