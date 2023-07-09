export const typeDefs = `#graphql
	type Query {
		allPublishers: [Publisher]
		listAuthors(limit: Int, latest: Boolean): [Author]
		listCategories(language: String): [Category]!
	}
	type Publisher {
		uuid: String!
		name: String!
		description: String
		websiteUrl: String
		facebookUsername: String
		instagramUsername: String
		twitterUsername: String
		logo: PublisherLogo
		authors: [Author]
	}
	type PublisherLogo {
		uuid: String!
		url: String!
		blurhash: String
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
	type Category {
		uuid: String!
		key: String!
		name: CategoryName!
		names: [CategoryName]!
	}
	type CategoryName {
		uuid: String!
		name: String!
		language: String!
	}
`
