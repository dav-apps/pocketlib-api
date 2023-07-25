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

export const actionPermitted: ApiError = {
	code: "ACTION_PERMITTED",
	message: "Action permitted",
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

export const nameTooShort = "NAME_TOO_SHORT"
export const firstNameTooShort = "FIRST_NAME_TOO_SHORT"
export const lastNameTooShort = "LAST_NAME_TOO_SHORT"

export const nameTooLong = "NAME_TOO_LONG"
export const descriptionTooLong = "DESCRIPTION_TOO_LONG"
export const firstNameTooLong = "FIRST_NAME_TOO_LONG"
export const lastNameTooLong = "LAST_NAME_TOO_LONG"
export const bioTooLong = "BIO_TOO_LONG"

export const websiteUrlInvalid = "WEBSITE_URL_INVALID"
export const facebookUsernameInvalid = "FACEBOOK_USERNAME_INVALID"
export const instagramUsernameInvalid = "INSTAGRAM_USERNAME_INVALID"
export const twitterUsernameInvalid = "TWITTER_USERNAME_INVALID"
export const languageInvalid = "LANGUAGE_INVALID"