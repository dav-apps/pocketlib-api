import { QueryResult, ResolverContext, VlbPublisher } from "../types.js"
import { getPublisher } from "../services/vlbApiService.js"

export async function retrieveVlbPublisher(
	parent: any,
	args: { id: string },
	context: ResolverContext
): Promise<QueryResult<VlbPublisher>> {
	let publisher = await getPublisher(args.id)

	return {
		caching: publisher != null,
		data: {
			id: publisher.mvbId,
			name: publisher.name,
			url: publisher.url
		}
	}
}
