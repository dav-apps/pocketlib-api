export const apiBaseUrlDevelopment = "http://localhost:3111"
export const apiBaseUrlStaging =
	"https://dav-backend-tfpik.ondigitalocean.app/staging"
export const apiBaseUrlProduction =
	"https://dav-backend-tfpik.ondigitalocean.app/"
export const newApiBaseUrl = "http://localhost:4000"
export const admins = [1]
export const languages = ["en", "de"]

//#region App & Table ids
export const appId = 6
export const publisherTableId = 36
export const publisherLogoTableId = 38
export const authorBioTableId = 20
export const authorProfileImageTableId = 21
export const storeBookCollectionTableId = 22
export const storeBookCollectionNameTableId = 23
export const storeBookSeriesTableId = 16
export const storeBookTableId = 24
export const storeBookCoverTableId = 25
export const storeBookFileTableId = 26
export const storeBookPrintCoverTableId = 41
export const storeBookPrintFileTableId = 42
export const storeBookReleaseTableId = 32
export const bookTableId = 14
export const bookFileTableId = 15
//#endregion

//#region Regexes
export const facebookUsernameRegex =
	/^((https?:\/\/)?(www.)?facebook.com\/)?@?(?<username>[a-zA-Z0-9\.]{5,})(\/)?$/
export const instagramUsernameRegex =
	/^((https?:\/\/)?(www.)?instagram.com\/)?@?(?<username>[a-zA-Z0-9\._\-]{3,})(\/)?$/
export const twitterUsernameRegex =
	/^((https?:\/\/)?(www.)?twitter.com\/)?@?(?<username>[a-zA-Z0-9\._\-]{3,})(\/)?$/
export const urlRegex =
	/^(https?:\/\/)?[\w.-]+(\.[\w.-]+)+[\w\-._~/?#@&\+,;=]+$/
export const isbnRegex = /^([0-9]{10}|[0-9]{13})$/
export const filenameRegex = /filename=\"(?<filename>.*)\"/
//#endregion
