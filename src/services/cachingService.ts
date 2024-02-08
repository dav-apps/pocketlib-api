import { ResolverContext, QueryResult } from "../types.js"

function generateCacheKey(
	resolverName: string,
	uuid: string,
	args: object
): string {
	let environment = process.env.ENVIRONMENT || "development"
	let result = `${resolverName}-${environment}`

	if (uuid != null) {
		result += `:${uuid}`
	}

	for (let key of Object.keys(args)) {
		let value = args[key]
		result += `,${key}:${value}`
	}

	return result
}

export async function cachingResolver(
	parent: any,
	args: any,
	context: ResolverContext,
	info: any,
	resolver: Function
) {
	if (process.env.CACHING == "false") {
		let result: QueryResult<any> = await resolver(parent, args, context)
		return result.data
	}

	// Check if the result is cached
	let key = generateCacheKey(
		`${info.path.typename}-${info.path.key}`,
		parent?.uuid,
		args
	)
	let cachedResult = await context.redis.get(key)

	if (cachedResult != null) {
		return JSON.parse(cachedResult)
	}

	// Call the resolver function and save the result
	let result: QueryResult<any> = await resolver(parent, args, context)

	if (result.caching) {
		await context.redis.set(key, JSON.stringify(result.data))
		await context.redis.expire(key, 60 * 60 * 24) // Expire after 1 day
	}

	return result.data
}
