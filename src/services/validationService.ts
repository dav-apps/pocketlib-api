import { languages, urlRegex } from "../constants.js"
import * as Errors from "../errors.js"

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

export function validateNameLength(name: string) {
	if (name.length < 2) {
		return Errors.nameTooShort
	} else if (name.length > 100) {
		return Errors.nameTooLong
	}
}

export function validateDescriptionLength(description: string) {
	if (description.length > 5700) {
		return Errors.descriptionTooLong
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
