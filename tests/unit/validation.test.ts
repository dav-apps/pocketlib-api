import { describe, expect, it } from "vitest"
import * as validate from "../../src/services/validationService.js"
import { apiErrors, validationErrors as errors } from "../../src/errors.js"

describe("text length boundaries", () => {
	it.each([
		[
			validate.validateNameLength,
			2,
			100,
			errors.nameTooShort,
			errors.nameTooLong
		],
		[
			validate.validateFirstNameLength,
			2,
			20,
			errors.firstNameTooShort,
			errors.firstNameTooLong
		],
		[
			validate.validateLastNameLength,
			2,
			20,
			errors.lastNameTooShort,
			errors.lastNameTooLong
		],
		[
			validate.validateTitleLength,
			2,
			60,
			errors.titleTooShort,
			errors.titleTooLong
		],
		[
			validate.validateReleaseNameLength,
			2,
			100,
			errors.releaseNameTooShort,
			errors.releaseNameTooLong
		]
	] as const)(
		"%s accepts only lengths within its bounds",
		(fn, min, max, short, long) => {
			expect(fn("x".repeat(min - 1))).toBe(short)
			expect(fn("x".repeat(min))).toBeUndefined()
			expect(fn("x".repeat(max))).toBeUndefined()
			expect(fn("x".repeat(max + 1))).toBe(long)
		}
	)
})

describe("prices in cents", () => {
	it.each([
		[validate.validatePrice, errors.priceInvalid],
		[validate.validatePrintPrice, errors.printPriceInvalid]
	] as const)("%s enforces the price range", (fn, error) => {
		expect(fn(-1)).toBe(error)
		expect(fn(0)).toBeUndefined()
		expect(fn(100000)).toBeUndefined()
		expect(fn(100001)).toBe(error)
	})
})

describe("print files", () => {
	it.each([31, 1000])("rejects %i pages", pages => {
		expect(validate.validateStoreBookPrintFilePages(pages)).toBe(
			errors.storeBookPrintFilePagesInvalid
		)
	})
	it.each([32, 999])("accepts %i pages", pages => {
		expect(validate.validateStoreBookPrintFilePages(pages)).toBeUndefined()
	})
	it("requires a single cover page", () => {
		expect(validate.validateStoreBookPrintCoverPages(1)).toBeUndefined()
		expect(validate.validateStoreBookPrintCoverPages(0)).toBe(
			errors.storeBookPrintCoverPagesInvalid
		)
		expect(validate.validateStoreBookPrintCoverPages(2)).toBe(
			errors.storeBookPrintCoverPagesInvalid
		)
	})
	it("checks the trim dimensions in PDF points", () => {
		expect(
			validate.validateStoreBookPrintFilePageSize(396, 612)
		).toBeUndefined()
		expect(validate.validateStoreBookPrintFilePageSize(612, 396)).toBe(
			errors.storeBookPrintFilePageSizeInvalid
		)
		expect(validate.validateStoreBookPrintFilePageSize(595, 842)).toBe(
			errors.storeBookPrintFilePageSizeInvalid
		)
	})
})

describe("supported values", () => {
	it.each(["unpublished", "review", "published", "hidden"])(
		"accepts status %s",
		status => {
			expect(validate.validateStatus(status)).toBeUndefined()
		}
	)
	it("rejects unknown statuses and languages", () => {
		expect(validate.validateStatus("approved")).toBe(errors.statusInvalid)
		expect(validate.validateLanguage("de")).toBeUndefined()
		expect(validate.validateLanguage("en")).toBeUndefined()
		expect(validate.validateLanguage("xx")).toBe(errors.languageInvalid)
	})
	it.each([
		[validate.validateImageContentType, "image/png", "image/svg+xml"],
		[
			validate.validateEbookContentType,
			"application/epub+zip",
			"application/zip"
		],
		[validate.validatePdfContentType, "application/pdf", "text/plain"]
	] as const)("%s checks the upload type", (fn, allowed, forbidden) => {
		expect(fn(allowed)).toBeUndefined()
		expect(fn(forbidden)).toEqual(apiErrors.contentTypeNotSupported)
	})
})
