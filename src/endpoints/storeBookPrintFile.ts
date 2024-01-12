import { Express, Request, Response, raw } from "express"
import cors from "cors"
import { handleEndpointError } from "../utils.js"

export async function uploadStoreBookPrintFile(req: Request, res: Response) {
	try {
	} catch (error) {
		handleEndpointError(res, error)
	}
}

export function setup(app: Express) {
	app.put(
		"/storeBooks/:uuid/printFile",
		raw({ type: "*/*", limit: "100mb" }),
		cors(),
		uploadStoreBookPrintFile
	)
}
