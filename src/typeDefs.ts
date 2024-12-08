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
			random: Boolean
			limit: Int
			offset: Int
		): AuthorList!
		retrieveStoreBookCollection(uuid: String!): StoreBookCollection
		retrieveStoreBookCollectionName(uuid: String!): StoreBookCollectionName
		retrieveStoreBookSeries(uuid: String!): StoreBookSeries
		listStoreBookSeries(
			random: Boolean
			languages: [String!]
			limit: Int
			offset: Int
		): StoreBookSeriesList!
		retrieveStoreBook(uuid: String!): StoreBook
		listStoreBooks(
			categories: [String!]
			inReview: Boolean
			random: Boolean
			query: String
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
		retrieveVlbItem(uuid: String!): VlbItem
		listVlbItems(
			random: Boolean
			vlbPublisherId: String
			vlbAuthorUuid: String
			vlbCollectionUuid: String
			limit: Int
			offset: Int
		): VlbItemList!
		retrieveVlbPublisher(id: String!): VlbPublisher
		retrieveVlbAuthor(uuid: String!): VlbAuthor
		retrieveVlbCollection(uuid: String!): VlbCollection
		listVlbCollections(
			random: Boolean
			limit: Int
			offset: Int
		): VlbCollectionList!
		search(
			query: String!
			limit: Int
			offset: Int
		): SearchResultList!
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
			printPrice: Int
			isbn: String
			categories: [String!]
		): StoreBook
		updateStoreBook(
			uuid: String!
			title: String
			description: String
			language: String
			price: Int
			printPrice: Int
			isbn: String
			status: String
			categories: [String!]
		): StoreBook
		publishStoreBookRelease(
			uuid: String!
			releaseName: String!
			releaseNotes: String
		): StoreBookRelease
		createCheckoutSessionForStoreBook(
			storeBookUuid: String!
			successUrl: String!
			cancelUrl: String!
		): CheckoutSession
		createCheckoutSessionForVlbItem(
			uuid: String!
			successUrl: String!
			cancelUrl: String!
		): CheckoutSession
		createBook(storeBook: String!): Book
		completeOrder(orderUuid: String!): Order
	}

	type Publisher {
		uuid: String!
		slug: String!
		name: String!
		description: String
		websiteUrl: String
		facebookUsername: String
		instagramUsername: String
		twitterUsername: String
		logo: PublisherLogo
		authors(
			limit: Int
			offset: Int
			query: String
		): AuthorList!
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
		slug: String!
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
		slug: String!
		title: String!
		description: String
		language: String!
		price: Int!
		printPrice: Int!
		isbn: String
		luluPrintableId: String
		status: String!
		cover: StoreBookCover
		file: StoreBookFile
		printCover: StoreBookPrintCover
		printFile: StoreBookPrintFile
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
		printPrice: Int!
		isbn: String
		status: String
		cover: StoreBookCover
		file: StoreBookFile
		printCover: StoreBookPrintCover
		printFile: StoreBookPrintFile
		categories(limit: Int, offset: Int): CategoryList!
	}

	type StoreBookReleaseList {
		total: Int!
		items: [StoreBookRelease!]!
	}

	type CheckoutSession {
		url: String!
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

	type StoreBookPrintCover {
		uuid: String!
		fileName: String
	}

	type StoreBookPrintFile {
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

	type VlbItem {
		uuid: String!
		slug: String!
		isbn: String!
		title: String!
		description: String
		price: Float!
		publisher: VlbPublisher
		author: VlbAuthor
		coverUrl: String
		collections: [VlbCollection!]
	}

	type VlbItemList {
		total: Int!
		items: [VlbItem!]!
	}

	type VlbCollection {
		uuid: String!
		slug: String!
		title: String!
		vlbItems(
			limit: Int
			offset: Int
		): VlbItemList!
	}

	type VlbCollectionList {
		total: Int!
		items: [VlbCollection!]!
	}

	type VlbPublisher {
		id: String!
		name: String!
		url: String
	}

	type VlbAuthor {
		uuid: String!
		slug: String!
		isni: String
		firstName: String!
		lastName: String!
		bio: String
	}

	type Order {
		uuid: String!
	}

	union SearchResult = StoreBook | VlbItem

	type SearchResultList {
		total: Int!
		items: [SearchResult!]!
	}
`
