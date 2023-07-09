import axios, { AxiosRequestConfig } from "axios"
import { apiBaseUrl } from "../constants.js"
import { TableObject } from "../types.js"

export async function getTableObject(uuid: string): Promise<TableObject> {
	try {
		let response = await axios({
			method: "get",
			url: `${apiBaseUrl}/v2/table_objects/${uuid}`
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
	limit?: number
	collectionName?: string
	tableName?: string
	userId?: number
}): Promise<TableObject[]> {
	try {
		let requestParams: AxiosRequestConfig = {}

		if (params.limit != null) requestParams["limit"] = params.limit
		if (params.collectionName != null)
			requestParams["collection_name"] = params.collectionName
		if (params.tableName != null)
			requestParams["table_name"] = params.tableName
		if (params.userId != null) requestParams["user_id"] = params.userId

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
