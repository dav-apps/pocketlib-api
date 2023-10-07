import { throwEndpointError } from "../utils.js"
import { languages, urlRegex, isbnRegex } from "../constants.js"
import { apiErrors, validationErrors } from "../errors.js"

//#region Endpoint validations
export async function validateImageContentType(contentType: string) {
	if (contentType != "image/png" && contentType != "image/jpeg") {
		throwEndpointError(apiErrors.contentTypeNotSupported)
	}
}

export async function validateEbookContentType(contentType: string) {
	if (
		contentType != "application/epub+zip" &&
		contentType != "application/pdf"
	) {
		throwEndpointError(apiErrors.contentTypeNotSupported)
	}
}
//#endregion

//#region Field validations
export function validateNameLength(name: string) {
	if (name.length < 2) {
		return validationErrors.nameTooShort
	} else if (name.length > 100) {
		return validationErrors.nameTooLong
	}
}

export function validateFirstNameLength(firstName: string) {
	if (firstName.length < 2) {
		return validationErrors.firstNameTooShort
	} else if (firstName.length > 20) {
		return validationErrors.firstNameTooLong
	}
}

export function validateLastNameLength(lastName: string) {
	if (lastName.length < 2) {
		return validationErrors.lastNameTooShort
	} else if (lastName.length > 20) {
		return validationErrors.lastNameTooLong
	}
}

export function validateBioLength(bio: string) {
	if (bio.length > 2000) {
		return validationErrors.bioTooLong
	}
}

export function validateTitleLength(title: string) {
	if (title.length < 2) {
		return validationErrors.titleTooShort
	} else if (title.length > 60) {
		return validationErrors.titleTooLong
	}
}

export function validateDescriptionLength(description: string) {
	if (description.length > 5700) {
		return validationErrors.descriptionTooLong
	}
}

export function validateCategoriesLength(categories: string[]) {
	if (categories.length > 3) {
		return validationErrors.storeBookMaxCategories
	}
}

export function validateReleaseNameLength(releaseName: string) {
	if (releaseName.length < 2) {
		return validationErrors.releaseNameTooShort
	} else if (releaseName.length > 100) {
		return validationErrors.releaseNameTooLong
	}
}

export function validateReleaseNotesLength(releaseNotes: string) {
	if (releaseNotes.length > 5700) {
		return validationErrors.releaseNotesTooLong
	}
}

export function validateWebsiteUrl(websiteUrl: string) {
	if (websiteUrl.length > 0 && !urlRegex.test(websiteUrl)) {
		return validationErrors.websiteUrlInvalid
	}
}

export function validateLanguage(language: string) {
	if (!languages.includes(language)) {
		return validationErrors.languageInvalid
	}
}

export function validatePrice(price: number) {
	if (price < 0 || price > 100000) {
		return validationErrors.priceInvalid
	}
}

export function validateIsbn(isbn: string) {
	// Must be of length 0, 10 or 13 and only contain numbers
	let isbnValid = isbn.length == 0 || isbnRegex.test(isbn)

	if (
		(isbn.length != 0 && isbn.length != 10 && isbn.length != 13) ||
		!isbnValid
	) {
		return validationErrors.isbnInvalid
	}
}

export function validateStatus(status: string) {
	if (!["unpublished", "review", "published", "hidden"].includes(status)) {
		return validationErrors.statusInvalid
	}
}
//#endregion
