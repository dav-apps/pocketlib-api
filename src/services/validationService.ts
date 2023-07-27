import { languages, urlRegex, isbnRegex } from "../constants.js"
import * as Errors from "../errors.js"

export function validateNameLength(name: string) {
	if (name.length < 2) {
		return Errors.nameTooShort
	} else if (name.length > 100) {
		return Errors.nameTooLong
	}
}

export function validateFirstNameLength(firstName: string) {
	if (firstName.length < 2) {
		return Errors.firstNameTooShort
	} else if (firstName.length > 20) {
		return Errors.firstNameTooLong
	}
}

export function validateLastNameLength(lastName: string) {
	if (lastName.length < 2) {
		return Errors.lastNameTooShort
	} else if (lastName.length > 20) {
		return Errors.lastNameTooLong
	}
}

export function validateBioLength(bio: string) {
	if (bio.length > 2000) {
		return Errors.bioTooLong
	}
}

export function validateTitleLength(title: string) {
	if (title.length < 2) {
		return Errors.titleTooShort
	} else if (title.length > 60) {
		return Errors.titleTooLong
	}
}

export function validateDescriptionLength(description: string) {
	if (description.length > 5700) {
		return Errors.descriptionTooLong
	}
}

export function validateCategoriesLength(categories: string[]) {
	if (categories.length > 3) {
		return Errors.storeBookMaxCategories
	}
}

export function validateReleaseNameLength(releaseName: string) {
	if (releaseName.length < 2) {
		return Errors.releaseNameTooShort
	} else if (releaseName.length > 100) {
		return Errors.releaseNameTooLong
	}
}

export function validateReleaseNotesLength(releaseNotes: string) {
	if (releaseNotes.length > 5700) {
		return Errors.releaseNotesTooLong
	}
}

export function validateWebsiteUrl(websiteUrl: string) {
	if (!urlRegex.test(websiteUrl)) {
		return Errors.websiteUrlInvalid
	}
}

export function validateLanguage(language: string) {
	if (!languages.includes(language)) {
		return Errors.languageInvalid
	}
}

export function validatePrice(price: number) {
	if (price < 0 || price > 100000) {
		return Errors.priceInvalid
	}
}

export function validateIsbn(isbn: string) {
	// Must be of length 0, 10 or 13 and only contain numbers
	let isbnValid = isbn.length == 0 || isbnRegex.test(isbn)

	if (
		(isbn.length != 0 && isbn.length != 10 && isbn.length != 13) ||
		!isbnValid
	) {
		return Errors.isbnInvalid
	}
}

export function validateStatus(status: string) {
	if (!["unpublished", "review", "published", "hidden"].includes(status)) {
		return Errors.statusInvalid
	}
}
