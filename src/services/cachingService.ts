import { ResolverContext } from "../types.js"

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
		return await resolver(parent, args, context)
	}

	// Check if the result is cached
	let key = generateCacheKey(
		`${info.path.typename}-${info.path.key}`,
		parent?.uuid,
		args
	)
	let result = await context.redis.get(key)

	if (result != null) {
		return JSON.parse(result)
	}

	// Call the resolver function and save the result
	result = await resolver(parent, args, context)

	await context.redis.set(key, JSON.stringify(result))
	await context.redis.expire(key, 60 * 60 * 24) // Expire after 1 day

	return result
}
