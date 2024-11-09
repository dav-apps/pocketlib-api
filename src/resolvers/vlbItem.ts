import {
	getProduct,
	getProducts,
	getCollection
} from "../services/vlbApiService.js"
import { ResolverContext, QueryResult, List, VlbItem } from "../types.js"
import { randomNumber } from "../utils.js"

export async function retrieveVlbItem(
	parent: any,
	args: { id: string },
	context: ResolverContext
): Promise<QueryResult<VlbItem>> {
	let result = await getProduct(args.id)

	let identifier = result.identifiers.find(
		i => i.productIdentifierType == "15"
	)

	let title = result.titles.find(t => t.titleType == "01")
	let description = result.textContents?.find(t => t.textType == "03")
	let price = result.prices.find(
		p =>
			(p.priceType == "02" || p.priceType == "04") &&
			p.countriesIncluded == "DE"
	)
	let author = result.contributors?.find(c => c.contributorRole == "A01")
	let cover = result.supportingResources?.find(
		r => r.resourceContentType == "01"
	)

	return {
		caching: true,
		data: {
			__typename: "VlbItem",
			id: result.productId,
			isbn: identifier.idValue,
			title: title.title,
			description: description?.text,
			price: price.priceAmount * 100,
			publisher: result.publishers[0].publisherName,
			author:
				author != null
					? {
							firstName: author.firstName,
							lastName: author.lastName
					  }
					: null,
			coverUrl: cover.exportedLink
				? `${cover.exportedLink}?access_token=${process.env.VLB_COVER_TOKEN}`
				: null
		}
	}
}

export async function listVlbItems(
	parent: any,
	args: {
		random?: boolean
		collectionId?: string
		limit?: number
		offset?: number
	},
	context: ResolverContext
): Promise<QueryResult<List<VlbItem>>> {
	let take = args.limit || 10
	if (take <= 0) take = 10

	let skip = args.offset || 0
	if (skip < 0) skip = 0

	let random = args.random || false
	let items: VlbItem[] = []
	let total: number = 0

	if (random) {
		const query = `pt=pbook li=20 (wg=11** oder wg=21**)`

		let result = await getProducts({
			query,
			page: randomNumber(1, 10000 / take),
			size: take,
			active: true
		})

		total = result.totalElements

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
	} else if (args.collectionId != null) {
		let result = await getCollection({
			collectionId: args.collectionId
		})

		total = result.totalElements

		for (let product of result.content) {
			items.push({
				__typename: "VlbItem",
				id: product.id,
				isbn: product.isbn,
				title: product.title,
				description: null,
				price: product.priceEurD * 100,
				publisher: product.publisher,
				author: null,
				coverUrl:
					product.coverUrl != null
						? `${product.coverUrl}?access_token=${process.env.VLB_COVER_TOKEN}`
						: null
			})
		}
	}

	return {
		caching: true,
		data: {
			total,
			items
		}
	}
}
