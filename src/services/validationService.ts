import { roundUp, convertPtToInch } from "../utils.js"
import {
	languages,
	urlRegex,
	isbnRegex,
	dhlTrackingCodeRegex
} from "../constants.js"
import { apiErrors, validationErrors } from "../errors.js"

//#region Endpoint validations
export function validateImageContentType(contentType: string) {
	if (contentType != "image/png" && contentType != "image/jpeg") {
		return apiErrors.contentTypeNotSupported
	}
}

export function validateEbookContentType(contentType: string) {
	if (
		contentType != "application/epub+zip" &&
		contentType != "application/pdf"
	) {
		return apiErrors.contentTypeNotSupported
	}
}

export function validatePdfContentType(contentType: string) {
	if (contentType != "application/pdf") {
		return apiErrors.contentTypeNotSupported
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

export function validatePrintPrice(price: number) {
	if (price < 0 || price > 100000) {
		return validationErrors.printPriceInvalid
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

export function validateStoreBookPrintCoverPages(pages: number) {
	if (pages != 1) {
		return validationErrors.storeBookPrintCoverPagesInvalid
	}
}

export function validateStoreBookPrintFilePages(pages: number) {
	if (pages < 32 || pages > 999) {
		return validationErrors.storeBookPrintFilePagesInvalid
	}
}

export function validateStoreBookPrintCoverPageSize(
	width: number,
	height: number,
	pages: number
) {
	const widthInch = Number(roundUp(convertPtToInch(width)).toFixed(1))
	const heightInch = Number(roundUp(convertPtToInch(height)).toFixed(1))

	// Calculate spine width
	const spineWidth = pages / 444 + 0.06

	// target width = (page width * 2) + (bleed margin * 2) + spine width
	const targetWidth = Number(
		roundUp(5.5 * 2 + 0.125 * 2 + spineWidth).toFixed(1)
	)

	// target height = page height + (bleed margin * 2)
	const targetHeight = Number(roundUp(8.5 + 0.125 * 2).toFixed(1))

	if (widthInch != targetWidth || heightInch != targetHeight) {
		return validationErrors.storeBookPrintCoverPageSizeInvalid
	}
}

export function validateStoreBookPrintFilePageSize(
	width: number,
	height: number
) {
	const widthInch = Number(convertPtToInch(width).toFixed(1))
	const heightInch = Number(convertPtToInch(height).toFixed(1))

	if (widthInch != 5.5 || heightInch != 8.5) {
		return validationErrors.storeBookPrintFilePageSizeInvalid
	}
}

export function validateDhlTrackingCode(dhlTrackingCode: string) {
	if (
		dhlTrackingCode.length > 0 &&
		!dhlTrackingCodeRegex.test(dhlTrackingCode)
	) {
		return validationErrors.dhlTrackingCodeInvalid
	}
}
//#endregion
