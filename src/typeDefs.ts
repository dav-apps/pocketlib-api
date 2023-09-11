export const typeDefs = `#graphql
	directive @auth(role: String) on FIELD_DEFINITION

	type Query {
		retrievePublisher(uuid: String!): Publisher
		listPublishers(
			limit: Int
			offset: Int
		): PublisherList!
		retrieveAuthor(uuid: String!): Author
		listAuthors(
			mine: Boolean
			limit: Int
			offset: Int
		): AuthorList!
		retrieveStoreBookCollection(uuid: String!): StoreBookCollection
		retrieveStoreBookCollectionName(uuid: String!): StoreBookCollectionName
		retrieveStoreBookSeries(uuid: String!): StoreBookSeries
		listStoreBookSeries(
			languages: [String!]
			limit: Int
			offset: Int
		): StoreBookSeriesList!
		retrieveStoreBook(uuid: String!): StoreBook
		listStoreBooks(
			categories: [String!]
			inReview: Boolean
			languages: [String!]
			limit: Int
			offset: Int
		): StoreBookList!
		retrieveStoreBookRelease(uuid: String!): StoreBookRelease
		retrieveCategory(uuid: String!): Category!
		listCategories(
			languages: [String!]
			limit: Int
			offset: Int
		): CategoryList!
	}

	type Mutation {
		createPublisher(name: String!): Publisher
		updatePublisher(
			uuid: String!
			name: String
			description: String
			websiteUrl: String
			facebookUsername: String
			instagramUsername: String
			twitterUsername: String
		): Publisher
		createAuthor(
			publisher: String
			firstName: String!
			lastName: String!
		): Author
		updateAuthor(
			uuid: String!
			firstName: String
			lastName: String
			websiteUrl: String
			facebookUsername: String
			instagramUsername: String
			twitterUsername: String
		): Author
		setAuthorBio(
			uuid: String!
			bio: String!
			language: String!
		): AuthorBio
		setStoreBookCollectionName(
			uuid: String!
			name: String!
			language: String!
		): StoreBookCollectionName
		createStoreBookSeries(
			author: String
			name: String!
			language: String!
			storeBooks: [String!]
		): StoreBookSeries
		updateStoreBookSeries(
			uuid: String!
			name: String
			storeBooks: [String!]
		): StoreBookSeries
		createStoreBook(
			author: String
			collection: String
			title: String!
			description: String
			language: String!
			price: Int
			isbn: String
			categories: [String!]
		): StoreBook
		updateStoreBook(
			uuid: String!
			title: String
			description: String
			language: String
			price: Int
			isbn: String
			status: String
			categories: [String!]
		): StoreBook
		publishStoreBookRelease(
			uuid: String!
			releaseName: String!
			releaseNotes: String
		): StoreBookRelease
		createBook(storeBook: String!): Book
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
		bio(languages: [String!]): AuthorBio
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
		name(languages: [String!]): StoreBookCollectionName!
		names(limit: Int, offset: Int): StoreBookCollectionNameList!
		storeBooks(limit: Int, offset: Int): StoreBookList!
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
		status: String!
		cover: StoreBookCover
		file: StoreBookFile
		categories(limit: Int, offset: Int): CategoryList!
		series(limit: Int, offset: Int): StoreBookSeriesList!
		releases(limit: Int, offset: Int): StoreBookReleaseList! @auth(role: "AUTHOR")
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
		releaseName: String
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

	type StoreBookReleaseList {
		total: Int!
		items: [StoreBookRelease!]!
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
		name(languages: [String!]): CategoryName!
		names(limit: Int, offset: Int): CategoryNameList!
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

	type CategoryNameList {
		total: Int!
		items: [CategoryName!]!
	}

	type Book {
		uuid: String!
		storeBook: String
		file: String!
	}
`
