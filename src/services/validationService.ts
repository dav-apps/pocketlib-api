import { languages } from "../constants.js"

export function runValidations(...results: string[]) {
	let errorMessages: string[] = []

	for (let result of results) {
		if (result != null) {
			errorMessages.push(result)
		}
	}

	return errorMessages
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
