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
	args: { query: string; limit?: number; offset?: number },
	context: ResolverContext
): Promise<QueryResult<List<StoreBook | VlbItem>>> {
	let take = args.limit ?? 10
	if (take <= 0) take = 10

	let skip = args.offset ?? 0
	if (skip < 0) skip = 0

	const query = `${args.query.toLowerCase()} und (pt=pbook) und (li=20)`

	let result = await getProducts({
		query,
		page: skip > 0 ? Math.floor(skip / take) + 1 : 1,
		size: take
	})

	let items: VlbItem[] = []

	for (let product of result.content) {
		let author = product.contributors?.find(c => c.type == "A01")

		items.push({
			__typename: "VlbItem",
			id: product.productId,
			isbn: product.isbn,
			title: product.title,
			description: product.mainDescription,
			price: product.priceEurD * 100,
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
