import { QueryResult, ResolverContext, VlbPublisher } from "../types.js"
import { getPublisher } from "../services/vlbApiService.js"

export async function retrieveVlbPublisher(
	parent: any,
	args: { id: string },
	context: ResolverContext
): Promise<QueryResult<VlbPublisher>> {
	let publisher = await getPublisher(args.id)
	let url = publisher.url

	if (!/^https?:\/\//i.test(url)) {
		url = `https://${url}`
	}

	return {
		caching: publisher != null,
		data: {
			id: publisher.mvbId,
			name: publisher.name,
			url
		}
	}
}
