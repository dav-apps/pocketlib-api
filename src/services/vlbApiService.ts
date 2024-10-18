import axios from "axios"
import { vlbApiBaseUrl } from "../constants.js"

export async function getProducts(query: string): Promise<{
	content: {
		productId: string
		isbn: string
		title: string
		mainDescription?: string
		publisher: string
		contributors: {
			type: string
			firstName: string
			lastName: string
		}[]
		coverUrl?: string
	}[]
	totalPages: number
	totalElements: number
}> {
	try {
		let response = await axios({
			method: "get",
			url: `${vlbApiBaseUrl}/products`,
			headers: {
				Authorization: `Bearer ${process.env.VLB_METADATA_TOKEN}`
			},
			params: {
				search: `${query} und (pt=pbook)`
			}
		})

		return response.data
	} catch (error) {
		console.error(error)
		return null
	}
}
