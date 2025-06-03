import { Html, Body, Heading } from "@react-email/components"
import { VlbItem } from "@prisma/client"
import { OrderResource } from "dav-js"

const pStyles = {
	margin: "0"
}

export default function Email(props: {
	order: OrderResource
	vlbItem: VlbItem
}) {
	const shippingAddress = props.order?.shippingAddress
	const price = props.order?.price
	let formattedPrice = ""

	if (price != null) {
		formattedPrice = `${(price / 100).toFixed(2)} €`
	}

	return (
		<Html>
			<Body>
				<p style={pStyles}>Order UUID: {props.order?.uuid}</p>
				<p style={pStyles}>VlbItem UUID: {props.vlbItem?.uuid}</p>
				<p style={pStyles}>MVB ID: {props.vlbItem?.mvbId}</p>
				<p style={pStyles}>Title: {props.vlbItem?.title}</p>
				<p style={pStyles}>Price: {formattedPrice}</p>

				<Heading as="h2">Shipping address</Heading>

				<p style={pStyles}>Name: {shippingAddress?.name}</p>
				<p style={pStyles}>Email: {shippingAddress?.email}</p>
				<p style={pStyles}>Phone: {shippingAddress?.phone}</p>
				<p style={pStyles}>City: {shippingAddress?.city}</p>
				<p style={pStyles}>Country: {shippingAddress?.country}</p>
				<p style={pStyles}>Line1: {shippingAddress?.line1}</p>
				<p style={pStyles}>Line2: {shippingAddress?.line2}</p>
				<p style={pStyles}>Postal code: {shippingAddress?.postalCode}</p>
				<p style={pStyles}>State: {shippingAddress?.state}</p>
			</Body>
		</Html>
	)
}
