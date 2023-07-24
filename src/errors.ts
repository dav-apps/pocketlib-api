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

export const publisherDoesNotExist: ApiError = {
	code: "PUBLISHER_NOT_EXISTS",
	message: "Publisher TableObject does not exist",
	status: 404
}

export const validationFailed: ApiError = {
	code: "VALIDATION_FAILED",
	message: "Validation failed",
	status: 400
}

export const facebookUsernameInvalid = "FACEBOOK_USERNAME_INVALID"
export const instagramUsernameInvalid = "INSTAGRAM_USERNAME_INVALID"
export const twitterUsernameInvalid = "TWITTER_USERNAME_INVALID"
