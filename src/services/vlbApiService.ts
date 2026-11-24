import axios, { AxiosRequestConfig, isAxiosError } from "axios"
import {
	VlbGetProductsResponseData,
	VlbGetProductResponseData,
	VlbGetCollectionResponseData
} from "../types.js"
import { vlbApiBaseUrl } from "../constants.js"

const timeout = 10_000
const retryableStatuses = [502, 503, 504]
const retryableCodes = ["ECONNRESET", "ECONNABORTED", "ETIMEDOUT", "EPIPE"]

function isRetryable(error: unknown): boolean {
	if (!isAxiosError(error)) return false
	if (error.response != null)
		return retryableStatuses.includes(error.response.status)
	return retryableCodes.includes(error.code)
}

// Logs only what helps debugging; never the request headers (Bearer token).
function logError(error: unknown, config: AxiosRequestConfig) {
	if (isAxiosError(error)) {
		console.error("VLB request failed", {
			url: config.url,
			params: config.params,
			code: error.code,
			status: error.response?.status,
			data: error.response?.data
		})
	} else {
		console.error("VLB request failed", { url: config.url, error })
	}
}

// All VLB calls are idempotent GETs, so one retry on transient failures
// (stale keep-alive sockets, overloaded Solr) is safe.
async function vlbGet<T>(config: AxiosRequestConfig): Promise<T> {
	const request: AxiosRequestConfig = {
		...config,
		method: "get",
		timeout,
		headers: {
			Authorization: `Bearer ${process.env.VLB_METADATA_TOKEN}`,
			...config.headers
		}
	}

	try {
		return (await axios(request)).data
	} catch (error) {
		if (isRetryable(error)) {
			await new Promise(resolve => setTimeout(resolve, 500))
			try {
				return (await axios(request)).data
			} catch (retryError) {
				logError(retryError, request)
				return null
			}
		}

		logError(error, request)
		return null
	}
}

export async function getProducts(params: {
	query: string
	page?: number
	size?: number
	active?: boolean
	sort?: "publicationDate"
}): Promise<VlbGetProductsResponseData> {
	return vlbGet({
		url: `${vlbApiBaseUrl}/products`,
		params: {
			search: params.query,
			page: params.page ?? 1,
			size: params.size ?? 10,
			active: params.active,
			sort: params.sort
		}
	})
}

export async function getProduct(
	id: string
): Promise<VlbGetProductResponseData> {
	return vlbGet({
		url: `${vlbApiBaseUrl}/product/${id}`,
		headers: { "Content-Type": "application/json-short" }
	})
}

export async function getCollection(params: {
	collectionId: string
	page?: number
	size?: number
}): Promise<VlbGetCollectionResponseData> {
	return vlbGet({
		url: `${vlbApiBaseUrl}/collections/collection/${params.collectionId}`,
		params: {
			page: params.page ?? 1,
			size: params.size ?? 10
		}
	})
}

export async function getPublisher(id: string): Promise<{
	mvbId: string
	name: string
	url: string
}> {
	return vlbGet({ url: `${vlbApiBaseUrl}/publisher/${id}` })
}
