export const typeDefs = `#graphql
	directive @auth(role: String) on FIELD_DEFINITION

	type Query {
		retrievePublisher(uuid: String!): Publisher
		listPublishers: [Publisher]
		retrieveAuthor(uuid: String!): Author
		listAuthors(limit: Int, latest: Boolean): [Author]
		retrieveStoreBook(uuid: String!, language: String): StoreBook
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
		authors: [Author!]!
	}

	type PublisherLogo {
		uuid: String!
		url: String!
		blurhash: String
	}

	type Author {
		uuid: String!
		publisher: Publisher
		firstName: String!
		lastName: String!
		websiteUrl: String
		facebookUsername: String
		instagramUsername: String
		twitterUsername: String
		profileImage: AuthorProfileImage
		bios: [AuthorBio!]!
		collections: [StoreBookCollection!]!
		series: [StoreBookSeries!]!
	}

	type AuthorBio {
		uuid: String!
		bio: String!
		language: String!
	}

	type AuthorProfileImage {
		uuid: String!
		url: String!
		blurhash: String!
	}

	type StoreBookCollection {
		uuid: String!
		author: Author!
		name: StoreBookCollectionName!
		names: [StoreBookCollectionName!]!
	}

	type StoreBookCollectionName {
		uuid: String!
		name: String!
		language: String!
	}

	type StoreBookSeries {
		uuid: String!
		author: Author!
		name: String!
		language: String!
		storeBooks: [StoreBook!]!
	}

	type StoreBook {
		uuid: String!
		collection: StoreBookCollection!
		title: String!
		description: String
		language: String!
		price: Int!
		isbn: String
		status: String
		cover: StoreBookCover
		file: StoreBookFile
		categories: [Category!]!
		releases: [StoreBookRelease!]!
		series: [StoreBookSeries!]!
		inLibrary: Boolean @auth(role: "USER")
		purchased: Boolean @auth(role: "USER")
	}

	type StoreBookRelease {
		uuid: String!
		storeBook: StoreBook!
		releaseName: String!
		releaseNotes: String
		publishedAt: String
		title: String!
		description: String
		price: Int!
		isbn: String
		status: String
		cover: StoreBookCover
		file: StoreBookFile
		categories: [Category!]!
	}

	type StoreBookCover {
		uuid: String!
		url: String!
		aspectRatio: String!
		blurhash: String!
	}

	type StoreBookFile {
		uuid: String!
		fileName: String
	}

	type Category {
		uuid: String!
		key: String!
		name: CategoryName!
		names: [CategoryName!]!
	}

	type CategoryName {
		uuid: String!
		name: String!
		language: String!
	}
`
