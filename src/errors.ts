export const apiErrors = {
	unexpectedError: {
		code: "UNEXPECTED_ERROR",
		message: "Unexpected error"
	},
	notAuthenticated: {
		code: "NOT_AUTHENTICATED",
		message: "You are not authenticated",
		status: 401
	},
	actionNotAllowed: {
		code: "ACTION_NOT_ALLOWED",
		message: "Action not allowed",
		status: 403
	},
	contentTypeNotSupported: {
		code: "CONTENT_TYPE_NOT_SUPPORTED",
		message: "Content-Type not supported",
		status: 415
	},
	validationFailed: {
		code: "VALIDATION_FAILED",
		message: "Validation failed",
		status: 400
	},
	sessionEnded: {
		code: "SESSION_ENDED",
		message: "Session has ended and must be renewed",
		status: 403
	},
	orderDoesNotExist: {
		code: "ORDER_NOT_EXISTS",
		message: "Order does not exist",
		status: 404
	},
	publisherDoesNotExist: {
		code: "PUBLISHER_NOT_EXISTS",
		message: "Publisher does not exist",
		status: 404
	},
	authorDoesNotExist: {
		code: "AUTHOR_NOT_EXISTS",
		message: "Author does not exist",
		status: 404
	},
	storeBookCollectionDoesNotExist: {
		code: "STORE_BOOK_COLLECTION_DOES_NOT_EXIST",
		message: "StoreBookCollection does not exist",
		status: 404
	},
	storeBookSeriesDoesNotExist: {
		code: "STORE_BOOK_SERIES_NOT_EXISTS",
		message: "StoreBookSeries does not exist",
		status: 404
	},
	storeBookDoesNotExist: {
		code: "STORE_BOOK_NOT_EXISTS",
		message: "StoreBook does not exist",
		status: 404
	},
	storeBookReleaseDoesNotExist: {
		code: "STORE_BOOK_RELEASE_NOT_EXISTS",
		message: "StoreBookRelease does not exist",
		status: 404
	},
	vlbItemDoesNotExist: {
		code: "VLB_ITEM_NOT_EXISTS",
		message: "VlbItem does not exist",
		status: 404
	},
	cannotUpdateStoreBookLanguage: {
		code: "CANNOT_UPDATE_LANGUAGE_OF_PUBLISHED_STORE_BOOK",
		message: "Can't update language of published store book",
		status: 422
	},
	storeBookReleaseAlreadyPublished: {
		code: "STORE_BOOK_RELEASE_ALREADY_PUBLISHED",
		message: "The StoreBookRelease is already published",
		status: 412
	},
	storeBookNotPublished: {
		code: "STORE_BOOK_NOT_PUBLISHED",
		message: "The StoreBook is not published",
		status: 412
	},
	storeBookLanguageNotMatching: {
		code: "STORE_BOOK_LANGUAGE_NOT_MATCHING",
		message:
			"The language of the StoreBook does not match the given language",
		status: 400
	},
	cannotAddFreeStoreBookToLibraryWithoutPurchase: {
		code: "CANNOT_ADD_FREE_STORE_BOOK_TO_LIBRARY_WITHOUT_PURCHASE",
		message: "Can't add free store book to library without purchase",
		status: 422
	},
	davProRequired: {
		code: "DAV_PRO_REQUIRED",
		message: "You need dav Pro to do this action",
		status: 422
	},
	storeBookAlreadyInLibrary: {
		code: "STORE_BOOK_ALREADY_IN_LIBRARY",
		message: "This StoreBook is already in your library",
		status: 422
	},
	orderHasIncorrectState: {
		code: "ORDER_HAS_INCORRECT_STATE",
		message: "The state of the order is incorrect",
		status: 409
	}
}

export const validationErrors = {
	authorRequired: "AUTHOR_REQUIRED",
	nameTooShort: "NAME_TOO_SHORT",
	firstNameTooShort: "FIRST_NAME_TOO_SHORT",
	lastNameTooShort: "LAST_NAME_TOO_SHORT",
	titleTooShort: "TITLE_TOO_SHORT",
	releaseNameTooShort: "RELEASE_NAME_TOO_SHORT",
	nameTooLong: "NAME_TOO_LONG",
	firstNameTooLong: "FIRST_NAME_TOO_LONG",
	lastNameTooLong: "LAST_NAME_TOO_LONG",
	bioTooLong: "BIO_TOO_LONG",
	titleTooLong: "TITLE_TOO_LONG",
	descriptionTooLong: "DESCRIPTION_TOO_LONG",
	releaseNameTooLong: "RELEASE_NAME_TOO_LONG",
	releaseNotesTooLong: "RELEASE_NOTES_TOO_LONG",
	websiteUrlInvalid: "WEBSITE_URL_INVALID",
	facebookUsernameInvalid: "FACEBOOK_USERNAME_INVALID",
	instagramUsernameInvalid: "INSTAGRAM_USERNAME_INVALID",
	twitterUsernameInvalid: "TWITTER_USERNAME_INVALID",
	languageInvalid: "LANGUAGE_INVALID",
	priceInvalid: "PRICE_INVALID",
	printPriceInvalid: "PRINT_PRICE_INVALID",
	isbnInvalid: "ISBN_INVALID",
	statusInvalid: "STATUS_INVALID",
	storeBookPrintCoverPagesInvalid: "PRINT_COVER_PAGES_INVALID",
	storeBookPrintFilePagesInvalid: "PRINT_FILE_PAGES_INVALID",
	storeBookPrintCoverPageSizeInvalid: "PRINT_COVER_PAGE_SIZE_INVALID",
	storeBookPrintFilePageSizeInvalid: "PRINT_FILE_PAGE_SIZE_INVALID",
	storeBookMaxCategories: "TOO_MANY_CATEGORIES_FOR_STORE_BOOK",
	cannotPublishStoreBookWithoutDescription:
		"CANNOT_PUBLISH_STORE_BOOK_WITHOUT_DESCRIPTION",
	cannotPublishStoreBookWithoutCover:
		"CANNOT_PUBLISH_STORE_BOOK_WITHOUT_COVER",
	cannotPublishStoreBookWithoutFile: "CANNOT_PUBLISH_STORE_BOOK_WITHOUT_FILE",
	cannotPublishStoreBookWithIncompletePrintFiles:
		"CANNOT_PUBLISH_STORE_BOOK_WITH_INCOMPLETE_PRINT_FILES",
	cannotPublishStoreBookWithFreePrintBook:
		"CANNOT_PUBLISH_STORE_BOOK_WITH_FREE_PRINT_BOOK"
}
