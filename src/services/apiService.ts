import axios from "axios"
import { request, gql } from "graphql-request"
import { Collection, Currency, TableObjectPriceType } from "../types.js"
import {
	apiBaseUrlDevelopment,
	apiBaseUrlStaging,
	apiBaseUrlProduction,
	newApiBaseUrlDevelopment,
	newApiBaseUrlStaging,
	newApiBaseUrlProduction
} from "../constants.js"

function getApiBaseUrl() {
	switch (process.env.ENV) {
		case "staging":
			return apiBaseUrlStaging
		case "production":
			return apiBaseUrlProduction
		default:
			return apiBaseUrlDevelopment
	}
}

function getNewApiBaseUrl() {
	switch (process.env.ENV) {
		case "staging":
			return newApiBaseUrlStaging
		case "production":
			return newApiBaseUrlProduction
		default:
			return newApiBaseUrlDevelopment
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

export async function createPaymentCheckoutSession(
	queryData: string,
	accessToken: string,
	variables: {
		tableObjectUuid: string
		type: TableObjectPriceType
		price?: number
		currency?: Currency
		productName: string
		productImage: string
		shippingRate?: {
			name: string
			price: number
		}
		successUrl: string
		cancelUrl: string
	}
): Promise<string> {
	let response = await request<{
		createPaymentCheckoutSession: { url: string }
	}>(
		getNewApiBaseUrl(),
		gql`
			mutation CreatePaymentCheckoutSession(
				$tableObjectUuid: String!
				$type: TableObjectPriceType!
				$price: Int
				$currency: Currency
				$productName: String!
				$productImage: String!
				$shippingRate: ShippingRate
				$successUrl: String!
				$cancelUrl: String!
			) {
				createPaymentCheckoutSession(
					tableObjectUuid: $tableObjectUuid
					type: $type
					price: $price
					currency: $currency
					productName: $productName
					productImage: $productImage
					shippingRate: $shippingRate
					successUrl: $successUrl
					cancelUrl: $cancelUrl
				) {
					${queryData}
				}
			}
		`,
		variables,
		{
			Authorization: accessToken
		}
	)

	return response.createPaymentCheckoutSession.url
}
