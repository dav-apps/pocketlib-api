import { VlbCollection } from "@prisma/client"
import validator from "validator"
import { QueryResult, ResolverContext } from "../types.js"

export async function retrieveVlbCollection(
	parent: any,
	args: { uuid: string },
	context: ResolverContext
): Promise<QueryResult<VlbCollection>> {
	const uuid = args.uuid
	let where: any = { uuid }

	if (!validator.isUUID(uuid)) {
		where = { slug: uuid }
	}

	let vlbCollection = await context.prisma.vlbCollection.findFirst({ where })

	return {
		caching: vlbCollection != null,
		data: vlbCollection
	}
}
