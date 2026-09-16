import {
	getDocument,
	type PDFDocumentProxy
} from "pdfjs-dist/legacy/build/pdf.mjs"

export async function withPdfDocument<T>(
	source: Parameters<typeof getDocument>[0],
	read: (document: PDFDocumentProxy) => T | Promise<T>
): Promise<T> {
	const task = getDocument(source)
	try {
		return await read(await task.promise)
	} finally {
		await task.destroy()
	}
}
