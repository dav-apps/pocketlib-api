export const typeDefs = `#graphql
	type Query {
		allPublishers: [Publisher]
		allAuthors: [Author]
	}
	type Publisher {
		uuid: String!
		name: String!
		description: String
		websiteUrl: String
		facebookUsername: String
		instagramUsername: String
		twitterUsername: String
		authors: [Author]
	}
	type Author {
		uuid: String!
		firstName: String!
		lastName: String!
		websiteUrl: String
		facebookUsername: String
		instagramUsername: String
		twitterUsername: String
	}
`
