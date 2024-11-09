import axios from "axios"
import { vlbApiBaseUrl } from "../constants.js"

export async function getProducts(params: {
	query: string
	page?: number
	size?: number
	active?: boolean
}): Promise<{
	content: {
		productId: string
		isbn: string
		title: string
		mainDescription?: string
		priceEurD: number
		publisher: string
		contributors?: {
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
				search: params.query,
				page: params.page ?? 1,
				size: params.size ?? 10,
				active: params.active
			}
		})

		return response.data
	} catch (error) {
		console.error(error)
		return null
	}
}

export async function getProduct(id: string): Promise<{
	productId: string
	titles: {
		title: string
		subtitle?: string
		titleType: string
	}[]
	contributors?: {
		firstName: string
		lastName: string
		contributorRole: string
	}[]
	identifiers: {
		productIdentifierType: string
		idValue: string
	}[]
	prices: {
		priceType: string
		countriesIncluded: string
		priceAmount: number
		priceStatus: string
	}[]
	publishers: {
		publisherName: string
	}[]
	textContents: {
		textType: string
		text: string
	}[]
	supportingResources: {
		resourceContentType: string
		exportedLink: string
	}[]
}> {
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
}): Promise<{
	content: {
		id: string
		title: string
		author: string
		isbn: string
		coverUrl: string
		priceEurD: number
		publisher: string
	}[]
	totalPages: number
	totalElements: number
}> {
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
