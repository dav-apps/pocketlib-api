import { Html, Body, Text, Link } from "@react-email/components"
import { Logo, ProductView } from "./components.js"

export default function Email(props: {
	name: string
	invoiceUrl: string
	product: {
		title: string
		price: string
		coverUrl: string
	}
}) {
	const name = props.name ?? "Name"
	const invoiceUrl = props.invoiceUrl
	const title = props.product?.title ?? "Titel"
	const price = props.product?.price ?? "1 €"
	const coverUrl =
		props.product?.coverUrl ??
		"https://dav-misc.fra1.cdn.digitaloceanspaces.com/pocketlib-book-placeholder.png"

	return (
		<Html>
			<Body style={{ fontFamily: "Roboto, Arial, sans-serif" }}>
				<Logo />

				<Text style={{ marginBottom: "8px" }}>Hi {name},</Text>
				<Text style={{ marginTop: "0" }}>
					vielen Dank für deine Bestellung! Folgender Artikel wird in Kürze
					zu dir geliefert:
				</Text>

				<ProductView title={title} coverUrl={coverUrl} price={price} />

				{invoiceUrl && (
					<Text>
						Hier findest du die Rechnung zu deiner Bestellung:{" "}
						<Link href={invoiceUrl} target="_blank">
							Rechnung öffnen
						</Link>
					</Text>
				)}

				<Text style={{ marginBottom: "8px" }}>Viele Grüße</Text>
				<Text style={{ marginTop: "0" }}>Dein PocketLib-Team</Text>
			</Body>
		</Html>
	)
}
