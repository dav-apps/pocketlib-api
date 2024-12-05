import { Img, Section, Text } from "@react-email/components"

export function Logo() {
	return (
		<Img
			alt="PocketLib Logo"
			height={50}
			src="https://dav-misc.fra1.cdn.digitaloceanspaces.com/pocketlib-logo.png"
			style={{ marginLeft: "auto", marginRight: "auto" }}
		/>
	)
}

export function ProductView(props: {
	title: string
	coverUrl: string
	price: string
}) {
	return (
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
								alt={props.title}
								height={220}
								src={props.coverUrl}
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
								{props.title}
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
								{props.price}
							</Text>
						</td>
					</tr>
				</tbody>
			</table>
		</Section>
	)
}
