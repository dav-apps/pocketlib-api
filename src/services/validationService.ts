import { languages, urlRegex } from "../constants.js"

export function validateFirstNameLength(firstName: string) {
	if (firstName.length < 2) {
		return "first_name_too_short"
	} else if (firstName.length > 20) {
		return "first_name_too_long"
	}
}

export function validateLastNameLength(lastName: string) {
	if (lastName.length < 2) {
		return "last_name_too_short"
	} else if (lastName.length > 20) {
		return "last_name_too_long"
	}
}

export function validateWebsiteUrlValidity(websiteUrl: string) {
	if (!urlRegex.test(websiteUrl)) {
		return "website_url_invalid"
	}
}

export function validateBioLength(bio: string) {
	if (bio.length > 2000) {
		return "bio_too_long"
	}
}

export function validateLanguage(language: string) {
	if (!languages.includes(language)) {
		return "language_invalid"
	}
}
