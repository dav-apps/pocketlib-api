import * as React from "react"
import { Html, Body, Img } from "@react-email/components"

export default function Email() {
	return (
		<Html>
			<Body>
				<Img
					alt="PocketLib Logo"
					height={50}
					src="https://dav-misc.fra1.cdn.digitaloceanspaces.com/pocketlib-logo.png"
					style={{ marginLeft: "auto", marginRight: "auto" }}
				/>
				<p>Hi David</p>
				<p>
					vielen Dank für deine Bestellung! Folgender Artikel wird in Kürze
					zu dir geliefert:
				</p>

				<p>{}</p>
			</Body>
		</Html>
	)
}
