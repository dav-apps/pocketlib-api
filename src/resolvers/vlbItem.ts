import { getProduct, getProducts } from "../services/vlbApiService.js"
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

	let collections: {
		id: string
		title: string
	}[] = []

	if (result.collections != null) {
		for (let c of result.collections) {
			collections.push({
				id: c.collectionId,
				title: c.title
			})
		}
	}

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
				: null,
			collections
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

			let collections: {
				id: string
				title: string
			}[] = []

			if (product.collections != null) {
				for (let c of product.collections) {
					collections.push({
						id: c.collectionId,
						title: c.title
					})
				}
			}

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
						: null,
				collections
			})
		}
	} else if (args.collectionId != null) {
		let result = await getProducts({
			query: args.collectionId,
			active: true,
			sort: "publicationDate"
		})

		total = result.totalElements

		for (let product of result.content) {
			let author = product.contributors?.find(c => c.type == "A01")

			let collections: {
				id: string
				title: string
			}[] = []

			if (product.collections != null) {
				for (let c of product.collections) {
					collections.push({
						id: c.collectionId,
						title: c.title
					})
				}
			}

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
						: null,
				collections
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

export async function description(
	vlbItem: VlbItem,
	args: any,
	context: ResolverContext
): Promise<QueryResult<string>> {
	let result = await getProduct(vlbItem.id)

	if (result == null) {
		return {
			caching: false,
			data: null
		}
	}

	let description = result.textContents?.find(t => t.textType == "03")

	return {
		caching: true,
		data: description?.text
	}
}

export async function author(
	vlbItem: VlbItem,
	args: any,
	context: ResolverContext
): Promise<QueryResult<{ firstName: string; lastName: string }>> {
	let result = await getProduct(vlbItem.id)

	if (result == null) {
		return {
			caching: false,
			data: null
		}
	}

	let author = result.contributors?.find(c => c.contributorRole == "A01")

	return {
		caching: true,
		data: author
	}
}
