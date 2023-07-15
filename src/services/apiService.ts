import axios, { AxiosRequestConfig } from "axios"
import { apiBaseUrl } from "../constants.js"
import { User, TableObject, Purchase } from "../types.js"

export async function getUser(token: string): Promise<User> {
	try {
		let response = await axios({
			method: "get",
			url: `${apiBaseUrl}/v1/user`,
			headers: {
				Authorization: token
			}
		})

		return {
			id: response.data.id,
			email: response.data.email,
			firstName: response.data.first_name,
			confirmed: response.data.confirmed,
			totalStorage: response.data.total_storage,
			usedStorage: response.data.used_storage,
			plan: response.data.plan,
			dev: response.data.dev,
			provider: response.data.provider,
			profileImage: response.data.profile_image,
			profileImageEtag: response.data.profile_image_etag
		}
	} catch (error) {
		console.error(error.response?.data || error)
		return null
	}
}

export async function getTableObject(
	uuid: string,
	caching = true
): Promise<TableObject> {
	try {
		let response = await axios({
			method: "get",
			url: `${apiBaseUrl}/v2/table_objects/${uuid}`,
			params: {
				caching
			}
		})

		return {
			uuid: response.data.uuid,
			userId: response.data.user_id,
			tableId: response.data.table_id,
			properties: response.data.properties
		}
	} catch (error) {
		console.error(error.response?.data || error)
		return null
	}
}

export async function listTableObjects(params: {
	caching?: boolean
	limit?: number
	offset?: number
	collectionName?: string
	tableName?: string
	userId?: number
	propertyName?: string
	propertyValue?: string
	exact?: boolean
}): Promise<TableObject[]> {
	try {
		let requestParams: AxiosRequestConfig = {}

		if (params.limit != null) requestParams["limit"] = params.limit
		if (params.offset != null) requestParams["offset"] = params.offset
		if (params.collectionName != null)
			requestParams["collection_name"] = params.collectionName
		if (params.tableName != null)
			requestParams["table_name"] = params.tableName
		if (params.userId != null) requestParams["user_id"] = params.userId
		if (params.propertyName != null)
			requestParams["property_name"] = params.propertyName
		if (params.propertyValue != null)
			requestParams["property_value"] = params.propertyValue
		if (params.exact != null) requestParams["exact"] = params.exact
		if (params.caching != null) requestParams["caching"] = params.caching

		let response = await axios({
			method: "get",
			url: `${apiBaseUrl}/v2/table_objects`,
			params: requestParams
		})

		let result: TableObject[] = []

		for (let obj of response.data.table_objects) {
			result.push({
				uuid: obj.uuid,
				userId: obj.user_id,
				tableId: obj.table_id,
				properties: obj.properties
			})
		}

		return result
	} catch (error) {
		console.error(error.response?.data || error)
		return []
	}
}

export async function listPurchasesOfTableObject(params: {
	uuid: string
	userId?: number
}): Promise<Purchase[]> {
	try {
		let requestParams: AxiosRequestConfig = {}

		if (params.userId != null) requestParams["user_id"] = params.userId

		let response = await axios({
			method: "get",
			url: `${apiBaseUrl}/v2/table_objects/${params.uuid}/purchases`,
			params: requestParams
		})

		let result: Purchase[] = []

		for (let purchase of response.data.purchases) {
			result.push({
				id: purchase.id,
				userId: purchase.user_id,
				uuid: purchase.uuid,
				paymentIntentId: purchase.payment_intent_id,
				providerName: purchase.provider_name,
				providerImage: purchase.provider_image,
				productName: purchase.product_name,
				productImage: purchase.product_image,
				price: purchase.price,
				currency: purchase.currency,
				completed: purchase.completed
			})
		}

		return result
	} catch (error) {
		console.error(error.response?.data || error)
		return []
	}
}
