import axios from "axios"
import {
	VlbGetProductsResponseData,
	VlbGetProductResponseData,
	VlbGetCollectionResponseData
} from "../types.js"
import { vlbApiBaseUrl } from "../constants.js"

export async function getProducts(params: {
	query: string
	page?: number
	size?: number
	active?: boolean
	sort?: "publicationDate"
}): Promise<VlbGetProductsResponseData> {
	try {
		let response = await axios({
			method: "get",
			url: `${vlbApiBaseUrl}/products`,
			headers: {
				Authorization: `Bearer ${process.env.VLB_METADATA_TOKEN}`
			},
			params: {
				search: params.query,
				page: params.page ?? 1,
				size: params.size ?? 10,
				active: params.active,
				sort: params.sort
			}
		})

		return response.data
	} catch (error) {
		console.error(error)
		return null
	}
}

export async function getProduct(
	id: string
): Promise<VlbGetProductResponseData> {
	try {
		let response = await axios({
			method: "get",
			url: `${vlbApiBaseUrl}/product/${id}`,
			headers: {
				Authorization: `Bearer ${process.env.VLB_METADATA_TOKEN}`,
				"Content-Type": "application/json-short"
			}
		})

		return response.data
	} catch (error) {
		console.error(error)
		return null
	}
}

export async function getCollection(params: {
	collectionId: string
	page?: number
	size?: number
}): Promise<VlbGetCollectionResponseData> {
	try {
		let response = await axios({
			method: "get",
			url: `${vlbApiBaseUrl}/collections/collection/${params.collectionId}`,
			headers: {
				Authorization: `Bearer ${process.env.VLB_METADATA_TOKEN}`
			},
			params: {
				page: params.page ?? 1,
				size: params.size ?? 10
			}
		})

		return response.data
	} catch (error) {
		console.error(error)
		return null
	}
}

export async function getPublisher(id: string): Promise<{
	mvbId: string
	name: string
	url: string
}> {
	try {
		let response = await axios({
			method: "get",
			url: `${vlbApiBaseUrl}/publisher/${id}`,
			headers: {
				Authorization: `Bearer ${process.env.VLB_METADATA_TOKEN}`
			}
		})

		return response.data
	} catch (error) {
		console.error(error)
		return null
	}
}
