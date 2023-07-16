export const typeDefs = `#graphql
	directive @auth(role: String) on FIELD_DEFINITION

	type Query {
		retrievePublisher(uuid: String!): Publisher
		listPublishers: PublisherList!
		retrieveAuthor(uuid: String!): Author
		listAuthors(latest: Boolean, languages: [String!], limit: Int, offset: Int): AuthorList!
		retrieveStoreBook(uuid: String!, languages: [String!]): StoreBook
		listCategories(languages: [String!]): CategoryList!
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
		authors(limit: Int, offset: Int): AuthorList!
	}

	type PublisherList {
		total: Int!
		items: [Publisher!]!
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
		bio: AuthorBio
		websiteUrl: String
		facebookUsername: String
		instagramUsername: String
		twitterUsername: String
		profileImage: AuthorProfileImage
		bios(limit: Int, offset: Int): AuthorBioList!
		collections(limit: Int, offset: Int): StoreBookCollectionList!
		series(limit: Int, offset: Int): StoreBookSeriesList!
	}

	type AuthorList {
		total: Int!
		items: [Author!]!
	}

	type AuthorBio {
		uuid: String!
		bio: String!
		language: String!
	}

	type AuthorBioList {
		total: Int!
		items: [AuthorBio!]!
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
		names(limit: Int, offset: Int): StoreBookCollectionNameList!
	}

	type StoreBookCollectionList {
		total: Int!
		items: [StoreBookCollection!]!
	}

	type StoreBookCollectionName {
		uuid: String!
		name: String!
		language: String!
	}

	type StoreBookCollectionNameList {
		total: Int!
		items: [StoreBookCollectionName!]!
	}

	type StoreBookSeries {
		uuid: String!
		author: Author!
		name: String!
		language: String!
		storeBooks(limit: Int, offset: Int): StoreBookList!
	}

	type StoreBookSeriesList {
		total: Int!
		items: [StoreBookSeries!]!
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
		categories(limit: Int, offset: Int): CategoryList!
		series(limit: Int, offset: Int): StoreBookSeriesList!
		inLibrary: Boolean @auth(role: "USER")
		purchased: Boolean @auth(role: "USER")
	}

	type StoreBookList {
		total: Int!
		items: [StoreBook!]!
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
		categories(limit: Int, offset: Int): CategoryList!
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

	type CategoryList {
		total: Int!
		items: [Category!]!
	}

	type CategoryName {
		uuid: String!
		name: String!
		language: String!
	}
`
