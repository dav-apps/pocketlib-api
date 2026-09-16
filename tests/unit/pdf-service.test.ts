import { expect, it, vi } from "vitest"
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs"
import { withPdfDocument } from "../../src/services/pdfService.js"

vi.mock("pdfjs-dist/legacy/build/pdf.mjs", () => ({ getDocument: vi.fn() }))

it("releases the PDF loading task after reading metadata", async () => {
	const destroy = vi.fn().mockResolvedValue(undefined)
	vi.mocked(getDocument).mockReturnValue({
		promise: Promise.resolve({ numPages: 32 }),
		destroy
	} as never)
	expect(await withPdfDocument({ data: new Uint8Array() }, pdf => pdf.numPages))
		.toBe(32)
	expect(destroy).toHaveBeenCalledOnce()
})

it.each(["loading", "validation"])(
	"releases the PDF loading task when %s fails",
	async stage => {
		const error = new Error("Invalid PDF")
		const destroy = vi.fn().mockResolvedValue(undefined)
		vi.mocked(getDocument).mockReturnValue({
			promise:
				stage === "loading"
					? Promise.reject(error)
					: Promise.resolve({ numPages: 32 }),
			destroy
		} as never)
		await expect(
			withPdfDocument({ url: "https://example.test/book.pdf" }, () => {
				throw error
			})
		).rejects.toBe(error)
		expect(destroy).toHaveBeenCalledOnce()
	}
)
