import axios, { AxiosRequestConfig } from "axios"
import { apiBaseUrl } from "../constants.js"
import { TableObject } from "../types.js"

export async function listTableObjects(properties: {
	tableName?: string
	userId?: number
}) {
	try {
		let params: AxiosRequestConfig = {}

		if (properties.tableName != null)
			params["table_name"] = properties.tableName
		if (properties.userId != null) params["user_id"] = properties.userId

		let response = await axios({
			method: "get",
			url: `${apiBaseUrl}/v2/table_objects`,
			params
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
		console.error(error.response.data)
		return []
	}
}
