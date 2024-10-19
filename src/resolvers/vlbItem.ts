import { ResolverContext, QueryResult, VlbItem } from "../types.js"
import { getProduct } from "../services/vlbApiService.js"

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
	let description = result.textContents.find(t => t.textType == "03")
	let author = result.contributors?.find(c => c.contributorRole == "A01")
	let cover = result.supportingResources.find(
		r => r.resourceContentType == "01"
	)

	return {
		caching: true,
		data: {
			__typename: "VlbItem",
			id: result.productId,
			isbn: identifier.idValue,
			title: title.title,
			description: description.text,
			publisher: result.publishers[0].publisherName,
			author: {
				firstName: author.firstName,
				lastName: author.lastName
			},
			coverUrl: cover.exportedLink
				? `${cover.exportedLink}?access_token=${process.env.VLB_COVER_TOKEN}`
				: null
		}
	}
}
