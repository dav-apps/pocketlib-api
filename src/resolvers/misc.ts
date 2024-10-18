import { getProducts } from "../services/vlbApiService.js"
import {
	ResolverContext,
	QueryResult,
	List,
	StoreBook,
	VlbItem
} from "../types.js"

export async function search(
	parent: any,
	args: { query: string },
	context: ResolverContext
): Promise<QueryResult<List<StoreBook | VlbItem>>> {
	let result = await getProducts(args.query)

	let items: VlbItem[] = []

	for (let product of result.content) {
		let author = product.contributors.find(c => c.type == "A01")

		items.push({
			__typename: "VlbItem",
			id: product.productId,
			isbn: product.isbn,
			title: product.title,
			description: product.mainDescription,
			publisher: product.publisher,
			author,
			coverUrl:
				product.coverUrl != null
					? `${product.coverUrl}?access_token=${process.env.VLB_COVER_TOKEN}`
					: null
		})
	}

	return {
		caching: true,
		data: {
			total: result.totalElements,
			items
		}
	}
}
