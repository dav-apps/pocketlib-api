import { ApiError } from "./types.js"

export const unexpectedError: ApiError = {
	code: "UNEXPECTED_ERROR",
	message: "Unexpected error"
}

export const notAuthenticated: ApiError = {
	code: "NOT_AUTHENTICATED",
	message: "You are not authenticated",
	status: 401
}

export const actionNotAllowed: ApiError = {
	code: "ACTION_NOT_ALLOWED",
	message: "Action not allowed",
	status: 403
}

export const validationFailed: ApiError = {
	code: "VALIDATION_FAILED",
	message: "Validation failed",
	status: 400
}

export const publisherDoesNotExist: ApiError = {
	code: "PUBLISHER_NOT_EXISTS",
	message: "Publisher does not exist",
	status: 404
}

export const authorDoesNotExist: ApiError = {
	code: "AUTHOR_NOT_EXISTS",
	message: "Author does not exist",
	status: 404
}

export const storeBookCollectionDoesNotExist: ApiError = {
	code: "STORE_BOOK_COLLECTION_DOES_NOT_EXIST",
	message: "StoreBookCollection does not exist",
	status: 404
}

export const storeBookDoesNotExist: ApiError = {
	code: "STORE_BOOK_NOT_EXISTS",
	message: "StoreBook does not exist",
	status: 404
}

export const storeBookReleaseDoesNotExist: ApiError = {
	code: "STORE_BOOK_RELEASE_NOT_EXISTS",
	message: "StoreBookRelease does not exist",
	status: 404
}

export const cannotUpdateStoreBookLanguage: ApiError = {
	code: "CANNOT_UPDATE_LANGUAGE_OF_PUBLISHED_STORE_BOOK",
	message: "Can't update language of published store book",
	status: 422
}

export const storeBookReleaseAlreadyPublished: ApiError = {
	code: "STORE_BOOK_RELEASE_ALREADY_PUBLISHED",
	message: "The StoreBookRelease is already published",
	status: 412
}

export const storeBookNotPublished: ApiError = {
	code: "STORE_BOOK_NOT_PUBLISHED",
	message: "The StoreBook is not published",
	status: 412
}

export const storeBookLanguageNotMatching: ApiError = {
	code: "STORE_BOOK_LANGUAGE_NOT_MATCHING",
	message: "The language of the StoreBook does not match the given language",
	status: 400
}

export const authorRequired = "AUTHOR_REQUIRED"

export const nameTooShort = "NAME_TOO_SHORT"
export const firstNameTooShort = "FIRST_NAME_TOO_SHORT"
export const lastNameTooShort = "LAST_NAME_TOO_SHORT"
export const titleTooShort = "TITLE_TOO_SHORT"
export const releaseNameTooShort = "RELEASE_NAME_TOO_SHORT"

export const nameTooLong = "NAME_TOO_LONG"
export const firstNameTooLong = "FIRST_NAME_TOO_LONG"
export const lastNameTooLong = "LAST_NAME_TOO_LONG"
export const bioTooLong = "BIO_TOO_LONG"
export const titleTooLong = "TITLE_TOO_LONG"
export const descriptionTooLong = "DESCRIPTION_TOO_LONG"
export const releaseNameTooLong = "RELEASE_NAME_TOO_LONG"
export const releaseNotesTooLong = "RELEASE_NOTES_TOO_LONG"

export const websiteUrlInvalid = "WEBSITE_URL_INVALID"
export const facebookUsernameInvalid = "FACEBOOK_USERNAME_INVALID"
export const instagramUsernameInvalid = "INSTAGRAM_USERNAME_INVALID"
export const twitterUsernameInvalid = "TWITTER_USERNAME_INVALID"
export const languageInvalid = "LANGUAGE_INVALID"
export const priceInvalid = "PRICE_INVALID"
export const isbnInvalid = "ISBN_INVALID"
export const statusInvalid = "STATUS_INVALID"

export const storeBookMaxCategories = "TOO_MANY_CATEGORIES_FOR_STORE_BOOK"
export const cannotPublishStoreBookWithoutDescription =
	"CANNOT_PUBLISH_STORE_BOOK_WITHOUT_DESCRIPTION"
export const cannotPublishStoreBookWithoutCover =
	"CANNOT_PUBLISH_STORE_BOOK_WITHOUT_COVER"
export const cannotPublishStoreBookWithoutFile =
	"CANNOT_PUBLISH_STORE_BOOK_WITHOUT_FILE"
