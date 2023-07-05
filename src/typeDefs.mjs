export const typeDefs = `#graphql
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
