import { VlbAuthor } from "@prisma/client"
import validator from "validator"
import { QueryResult, ResolverContext } from "../types.js"

export async function retrieveVlbAuthor(
	parent: any,
	args: { uuid: string },
	context: ResolverContext
): Promise<QueryResult<VlbAuthor>> {
	const uuid = args.uuid
	let where: any = { uuid }

	if (!validator.isUUID(uuid)) {
		where = { slug: uuid }
	}

	let vlbAuthor = await context.prisma.vlbAuthor.findFirst({ where })

	return {
		caching: vlbAuthor != null,
		data: vlbAuthor
	}
}
