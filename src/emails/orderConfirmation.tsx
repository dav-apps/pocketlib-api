import { Html, Body, Img, Section, Text, Link } from "@react-email/components"

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
			<Body>
				<Img
					alt="PocketLib Logo"
					height={50}
					src="https://dav-misc.fra1.cdn.digitaloceanspaces.com/pocketlib-logo.png"
					style={{ marginLeft: "auto", marginRight: "auto" }}
				/>
				<Text style={{ marginBottom: "8px" }}>Hi {name},</Text>
				<Text style={{ marginTop: "0" }}>
					vielen Dank für deine Bestellung! Folgender Artikel wird in Kürze
					zu dir geliefert:
				</Text>

				<Section style={{ marginTop: 16, marginBottom: 16 }}>
					<table>
						<tbody>
							<tr>
								<td
									style={{
										paddingRight: 32,
										boxSizing: "border-box"
									}}
								>
									<Img
										alt={title}
										height={220}
										src={coverUrl}
										style={{
											borderRadius: 8
										}}
									/>
								</td>
								<td>
									<Text
										style={{
											margin: "0px",
											marginTop: 8,
											fontSize: 20,
											lineHeight: "28px",
											fontWeight: 600,
											color: "rgb(17,24,39)"
										}}
									>
										{title}
									</Text>
									<Text
										style={{
											marginTop: 8,
											fontSize: 18,
											lineHeight: "28px",
											fontWeight: 600,
											color: "rgb(17,24,39)"
										}}
									>
										{price}
									</Text>
								</td>
							</tr>
						</tbody>
					</table>
				</Section>

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
