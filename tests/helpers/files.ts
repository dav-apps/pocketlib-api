import { createCanvas } from "canvas"

// Small, real files generated locally; no downloader or mocked decoder involved.
export function imageFile(
	format: "png" | "jpeg" = "png",
	width = 40,
	height = 60
) {
	const canvas = createCanvas(width, height)
	const ctx = canvas.getContext("2d")
	ctx.fillStyle = "#1268a8"
	ctx.fillRect(0, 0, width, height)
	return format === "png"
		? canvas.toBuffer("image/png")
		: canvas.toBuffer("image/jpeg")
}

export function pdfFile(pages = 32, width = 396, height = 612) {
	const canvas = createCanvas(width, height, "pdf")
	const ctx = canvas.getContext("2d")
	for (let page = 0; page < pages; page++) {
		if (page) ctx.addPage(width, height)
		ctx.fillRect(10, 10, 20, 20)
	}
	return canvas.toBuffer("application/pdf")
}
