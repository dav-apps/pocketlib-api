export const websiteBaseUrlDevelopment = "http://localhost:3001"
export const websiteBaseUrlStaging =
	"https://pocketlib-staging-oo6cn.ondigitalocean.app"
export const websiteBaseUrlProduction = "https://pocketlib.app"
export const luluApiBaseUrlStaging = "https://api.sandbox.lulu.com"
export const luluApiBaseUrlProduction = "https://api.lulu.com"
export const vlbApiBaseUrl = "https://api.vlb.de/api/v2"
export const admins = [1]
export const languages = ["en", "de"]
export const noReplyEmailAddress = "no-reply@dav-apps.tech"

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
export const vlbItemTableId = 46
//#endregion

//#region Regexes
export const facebookUsernameRegex =
	/^((https?:\/\/)?(www.)?facebook.com\/)?@?(?<username>[a-zA-Z0-9\.]{5,})(\/)?$/
export const instagramUsernameRegex =
	/^((https?:\/\/)?(www.)?instagram.com\/)?@?(?<username>[a-zA-Z0-9\._\-]{3,})(\/)?$/
export const twitterUsernameRegex =
	/^((https?:\/\/)?(www.)?twitter.com\/)?@?(?<username>[a-zA-Z0-9\._\-]{3,})(\/)?$/
export const urlRegex =
	/^(https?:\/\/)?(([\w.-]+(\.[\w.-]{2,4})+)|(localhost:[0-9]{3,4}))/
export const isbnRegex = /^([0-9]{10}|[0-9]{13})$/
export const filenameRegex = /filename=\"(?<filename>.*)\"/
export const dhlTrackingCodeRegex = /^[0-9]{14,22}$/
//#endregion
