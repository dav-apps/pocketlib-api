import { VlbCollection } from "@prisma/client"
import validator from "validator"
import { getProduct, getProducts } from "../services/vlbApiService.js"
import {
	ResolverContext,
	QueryResult,
	List,
	VlbItem,
	VlbPublisher
} from "../types.js"
import {
	randomNumber,
	loadVlbItem,
	findVlbItemByVlbGetProductsResponseDataItem,
	findVlbAuthor,
	findVlbCollections,
	vlbLanguageToLanguage
} from "../utils.js"

export async function retrieveVlbItem(
	parent: any,
	args: { uuid: string },
	context: ResolverContext
): Promise<QueryResult<VlbItem>> {
	const uuid = args.uuid
	let where: any = { uuid }

	if (!validator.isUUID(uuid)) {
		where = { slug: uuid }
	}

	let vlbItem = await context.prisma.vlbItem.findFirst({ where })

	if (vlbItem == null) {
		return {
			caching: false,
			data: null
		}
	}

	return {
		caching: true,
		data: await loadVlbItem(context.prisma, vlbItem)
	}
}

export async function listVlbItems(
	parent: any,
	args: {
		random?: boolean
		vlbPublisherId?: string
		vlbAuthorUuid?: string
		vlbCollectionUuid?: string
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
		const query = `pt=pbook li=20 wg=11**`

		let result = await getProducts({
			query,
			page: randomNumber(1, 10000 / take),
			size: take,
			active: true
		})

		total = result.totalElements

		for (let product of result.content) {
			items.push(
				await findVlbItemByVlbGetProductsResponseDataItem(
					context.prisma,
					product
				)
			)
		}
	} else if (args.vlbCollectionUuid != null) {
		let where: any = { uuid: args.vlbCollectionUuid }

		if (!validator.isUUID(args.vlbCollectionUuid)) {
			where = { slug: args.vlbCollectionUuid }
		}

		// Get the VlbCollection
		let vlbCollection = await context.prisma.vlbCollection.findFirst({
			where
		})

		if (vlbCollection != null) {
			let result = await getProducts({
				query: `${vlbCollection.mvbId} pt=pbook li=20`,
				page: skip > 0 ? Math.floor(skip / take) + 1 : 1,
				size: take,
				active: true,
				sort: "publicationDate"
			})

			total = result.totalElements

			for (let product of result.content) {
				items.push(
					await findVlbItemByVlbGetProductsResponseDataItem(
						context.prisma,
						product
					)
				)
			}
		}
	} else if (args.vlbPublisherId != null) {
		let result = await getProducts({
			query: `vl=${args.vlbPublisherId} pt=pbook li=20`,
			page: skip > 0 ? Math.floor(skip / take) + 1 : 1,
			size: take,
			active: true
		})

		total = result.totalElements

		for (let product of result.content) {
			items.push(
				await findVlbItemByVlbGetProductsResponseDataItem(
					context.prisma,
					product
				)
			)
		}
	} else if (args.vlbAuthorUuid != null) {
		let where: any = { uuid: args.vlbAuthorUuid }

		if (!validator.isUUID(args.vlbAuthorUuid)) {
			where = { slug: args.vlbAuthorUuid }
		}

		let vlbAuthor = await context.prisma.vlbAuthor.findFirst({
			where
		})

		if (vlbAuthor != null) {
			let query = `au="${vlbAuthor.lastName} ${vlbAuthor.firstName}" pt=pbook li=20`

			let result = await getProducts({
				query,
				page: skip > 0 ? Math.floor(skip / take) + 1 : 1,
				size: take,
				active: true
			})

			total = result.totalElements

			for (let product of result.content) {
				items.push(
					await findVlbItemByVlbGetProductsResponseDataItem(
						context.prisma,
						product
					)
				)
			}
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
	let result = await getProduct(vlbItem.mvbId)

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

export async function language(vlbItem: VlbItem): Promise<QueryResult<string>> {
	if (vlbItem.language != null) {
		return {
			caching: true,
			data: vlbItem.language
		}
	}

	let result = await getProduct(vlbItem.mvbId)

	if (result == null) {
		return {
			caching: false,
			data: null
		}
	}

	let lang = result.languages?.find(l => l.languageRole == "01")

	return {
		caching: true,
		data: vlbLanguageToLanguage(lang.languageCode)
	}
}

export async function publicationDate(
	vlbItem: VlbItem
): Promise<QueryResult<string>> {
	if (vlbItem.publicationDate != null) {
		return {
			caching: true,
			data: vlbItem.publicationDate
		}
	}

	let result = await getProduct(vlbItem.mvbId)

	if (result == null) {
		return {
			caching: false,
			data: null
		}
	}

	return {
		caching: true,
		data: result.publicationDate
	}
}

export async function pageCount(
	vlbItem: VlbItem
): Promise<QueryResult<number>> {
	if (vlbItem.pageCount != null) {
		return {
			caching: true,
			data: vlbItem.pageCount
		}
	}

	let result = await getProduct(vlbItem.mvbId)

	if (result == null) {
		return {
			caching: false,
			data: null
		}
	}

	return {
		caching: true,
		data: result.extent?.mainContentPageCount
	}
}

export async function publisher(
	vlbItem: VlbItem
): Promise<QueryResult<VlbPublisher>> {
	if (vlbItem.publisher != null) {
		return {
			caching: true,
			data: vlbItem.publisher
		}
	}

	let result = await getProduct(vlbItem.mvbId)

	if (result == null) {
		return {
			caching: false,
			data: null
		}
	}

	let publisher: VlbPublisher = null

	if (result.publishers.length > 0) {
		let p = result.publishers[0]

		let url = null

		if (p.webSites?.length > 0) {
			url = p.webSites[0].websiteLink

			if (!/^https?:\/\//i.test(url)) {
				url = `https://${url}`
			}
		}

		publisher = {
			id: p.idValue,
			name: p.adbName,
			url
		}
	}

	return {
		caching: true,
		data: publisher
	}
}

export async function author(
	vlbItem: VlbItem,
	args: any,
	context: ResolverContext
): Promise<QueryResult<{ firstName: string; lastName: string }>> {
	if (vlbItem.author != null) {
		return {
			caching: true,
			data: vlbItem.author
		}
	}

	let result = await getProduct(vlbItem.mvbId)

	if (result == null) {
		return {
			caching: false,
			data: null
		}
	}

	let author = result.contributors?.find(c => c.contributorRole == "A01")

	return {
		caching: true,
		data: await findVlbAuthor(context.prisma, author)
	}
}

export async function collections(
	vlbItem: VlbItem,
	args: any,
	context: ResolverContext
): Promise<QueryResult<VlbCollection[]>> {
	if (vlbItem.collections != null) {
		return {
			caching: true,
			data: vlbItem.collections
		}
	}

	let item = await getProduct(vlbItem.mvbId)

	if (item == null) {
		return {
			caching: false,
			data: []
		}
	}

	return {
		caching: true,
		data: await findVlbCollections(context.prisma, item.collections)
	}
}
