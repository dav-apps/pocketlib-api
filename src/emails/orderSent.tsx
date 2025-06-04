import * as React from "react"
import { Html, Body, Text } from "@react-email/components"
import { Logo, ProductView } from "./components.js"

export default function Email(props: {
	name: string
	product: {
		title: string
		price: string
		coverUrl: string
		dhlTrackingCode?: string
	}
}) {
	const name = props.name ?? "Name"
	const title = props.product?.title ?? "Titel"
	const price = props.product?.price ?? "1 €"
	const coverUrl =
		props.product?.coverUrl ??
		"https://dav-misc.fra1.cdn.digitaloceanspaces.com/pocketlib-book-placeholder.png"
	const dhlTrackingCode = props.product?.dhlTrackingCode ?? "123456789"

	return (
		<Html>
			<Body style={{ fontFamily: "Roboto, Arial, sans-serif" }}>
				<Logo />

				<Text style={{ marginBottom: "8px" }}>Hi {name},</Text>
				<Text style={{ marginTop: "0" }}>
					vielen Dank für deine Bestellung! Folgender Artikel wurde soeben
					verschickt und sollte innerhalb der nächsten Tagen bei dir
					ankommen:
				</Text>

				<ProductView title={title} coverUrl={coverUrl} price={price} />

				{dhlTrackingCode && (
					<Text style={{ marginBottom: "12px" }}>
						Du kannst die Lieferung hier verfolgen:{" "}
						<a
							href={`https://www.dhl.de/de/privatkunden/pakete-empfangen/verfolgen.html?piececode=${dhlTrackingCode}`}
							style={{
								color: "black",
								textDecoration: "none",
								fontWeight: "bold"
							}}
						>
							DHL Sendungsverfolgung
						</a>
					</Text>
				)}

				<Text style={{ marginBottom: "12px" }}>
					Bei Fragen kannst du dich jederzeit ans uns wenden:{" "}
					<a
						href="mailto:support@dav-apps.tech"
						style={{
							color: "black",
							textDecoration: "none",
							fontWeight: "bold"
						}}
					>
						support@dav-apps.tech
					</a>
				</Text>

				<Text style={{ marginBottom: "8px" }}>Viele Grüße</Text>
				<Text style={{ marginTop: "0" }}>Dein PocketLib-Team</Text>
			</Body>
		</Html>
	)
}
