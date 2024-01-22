import axios from "axios"
import {
	luluApiBaseUrlStaging,
	luluApiBaseUrlProduction
} from "../constants.js"
import { ShippingAddress } from "../types.js"

function getApiBaseUrl() {
	if (process.env.ENVIRONMENT == "production") {
		return luluApiBaseUrlProduction
	}

	return luluApiBaseUrlStaging
}

export async function authenticate(): Promise<{
	access_token: string
	expires_in: number
	refresh_expires_in: number
	token_type: string
	"not-before-policy": number
	scope: string
}> {
	try {
		const params = new URLSearchParams()
		params.append("grant_type", "client_credentials")

		let response = await axios({
			method: "post",
			url: `${getApiBaseUrl()}/auth/realms/glasstree/protocol/openid-connect/token`,
			headers: {
				Authorization: `Basic ${process.env.LULU_AUTH_KEY}`
			},
			data: params
		})

		return response.data
	} catch (error) {
		console.error(error)
		return null
	}
}

export async function createPrintJob(
	accessToken: string,
	params: {
		title: string
		externalId: string
		coverSourceUrl: string
		interiorSourceUrl: string
		shippingAddress: ShippingAddress
	}
): Promise<{ id: number }> {
	try {
		let response = await axios({
			method: "post",
			url: `${getApiBaseUrl()}/print-jobs`,
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${accessToken}`
			},
			data: {
				contact_email: "support@dav-apps.tech",
				external_id: params.externalId,
				line_items: [
					{
						title: params.title,
						quantity: 1,
						external_id: params.externalId,
						printable_normalization: {
							pod_package_id: "0550X0850BWSTDPB060UC444GXX",
							cover: {
								source_url: params.coverSourceUrl
							},
							interior: {
								source_url: params.interiorSourceUrl
							}
						}
					}
				],
				shipping_address: {
					name: params.shippingAddress.name,
					email: params.shippingAddress.email,
					phone_number: params.shippingAddress.phone,
					city: params.shippingAddress.city,
					country_code: params.shippingAddress.country,
					postcode: params.shippingAddress.postalCode,
					state_code: params.shippingAddress.state,
					street1: params.shippingAddress.line1,
					street2: params.shippingAddress.line2
				},
				shipping_level: "MAIL"
			}
		})

		return response.data
	} catch (error) {
		console.error(error)
		return null
	}
}
