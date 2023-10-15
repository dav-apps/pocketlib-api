import axios, { AxiosRequestConfig } from "axios"
import {
	List,
	UserApiResponse,
	TableObject,
	TableObjectPrice,
	Collection,
	Purchase
} from "../types.js"
import {
	apiBaseUrlDevelopment,
	apiBaseUrlStaging,
	apiBaseUrlProduction,
	appId
} from "../constants.js"

function getApiBaseUrl() {
	switch (process.env.ENVIRONMENT) {
		case "staging":
			return apiBaseUrlStaging
		case "production":
			return apiBaseUrlProduction
		default:
			return apiBaseUrlDevelopment
	}
}

export async function getUser(accessToken: string): Promise<UserApiResponse> {
	if (accessToken == null) {
		return null
	}

	try {
		let response = await axios({
			method: "get",
			url: `${getApiBaseUrl()}/v1/user`,
			headers: {
				Authorization: accessToken
			}
		})

		return {
			status: response.status,
			data: {
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
		}
	} catch (error) {
		return {
			status: error.response?.status || 500,
			errors: error.response?.data?.errors
		}
	}
}

export async function getTableObject(
	uuid: string,
	caching = true
): Promise<TableObject> {
	try {
		let response = await axios({
			method: "get",
			url: `${getApiBaseUrl()}/v2/table_objects/${uuid}`,
			headers: {
				Authorization: process.env.DAV_AUTH
			},
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
}): Promise<List<TableObject>> {
	try {
		let requestParams: AxiosRequestConfig = {}

		requestParams["app_id"] = appId
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
			url: `${getApiBaseUrl()}/v2/table_objects`,
			headers: {
				Authorization: process.env.DAV_AUTH
			},
			params: requestParams
		})

		let result: TableObject[] = []

		for (let obj of response.data.items) {
			result.push({
				uuid: obj.uuid,
				userId: obj.user_id,
				tableId: obj.table_id,
				properties: obj.properties
			})
		}

		return {
			total: response.data.total,
			items: result
		}
	} catch (error) {
		console.error(error.response?.data || error)
		return { total: 0, items: [] }
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
			url: `${getApiBaseUrl()}/v2/table_objects/${params.uuid}/purchases`,
			headers: {
				Authorization: process.env.DAV_AUTH
			},
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

export async function setTableObjectPrice(params: {
	uuid: string
	price: number
	currency: string
}): Promise<TableObjectPrice> {
	try {
		let response = await axios({
			method: "put",
			url: `${getApiBaseUrl()}/v2/table_objects/${params.uuid}/price`,
			headers: {
				Authorization: process.env.DAV_AUTH,
				"Content-Type": "application/json"
			},
			data: {
				price: params.price,
				currency: params.currency
			}
		})

		return {
			tableObjectUuid: response.data.table_object_uuid,
			price: response.data.price,
			currency: response.data.currency
		}
	} catch (error) {
		console.error(error.response?.data || error)
		return null
	}
}

export async function addTableObjectToCollection(params: {
	name: string
	uuid: string
	tableId: number
}): Promise<Collection> {
	try {
		let response = await axios({
			method: "post",
			url: `${getApiBaseUrl()}/v2/collections/${params.name}/table_objects/${
				params.uuid
			}`,
			headers: {
				Authorization: process.env.DAV_AUTH,
				"Content-Type": "application/json"
			},
			data: {
				table_id: params.tableId
			}
		})

		return {
			id: response.data.id,
			tableId: response.data.table_id,
			name: response.data.name
		}
	} catch (error) {
		console.error(error.response?.data || error)
		return null
	}
}

export async function addTableObject(params: {
	accessToken: string
	uuid: string
	tableAlias: number
}) {
	try {
		let response = await axios({
			method: "post",
			url: `${getApiBaseUrl()}/v1/table_object/${params.uuid}/access`,
			headers: {
				Authorization: params.accessToken,
				"Content-Type": "application/json"
			},
			data: {
				table_alias: params.tableAlias
			}
		})

		return {
			id: response.data.id,
			userId: response.data.user_id,
			tableObjectId: response.data.table_object_id,
			tableAlias: response.data.table_alias
		}
	} catch (error) {
		console.error(error.response?.data || error)
		return null
	}
}
