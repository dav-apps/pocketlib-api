export const apiBaseUrl = "http://localhost:3111"
export const admins = [1]
export const languages = ["en", "de"]

//#region App & Table ids
export const appId = 6
export const publisherTableId = 36
export const authorBioTableId = 20
export const storeBookCollectionTableId = 22
export const storeBookCollectionNameTableId = 23
export const storeBookSeriesTableId = 16
export const storeBookTableId = 24
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
//#endregion
