import { createHash, randomUUID } from "node:crypto"
import { serialize, deserialize } from "node:v8"
import type { ResolverContext, QueryResult } from "../types.js"

const prefix = "pocketlib:cache:v2:"
const revisionKey = `${prefix}revision`
const ttl = 60 * 60 * 24

function canonical(value: any): any {
	if (Array.isArray(value)) return value.map(canonical)
	if (value != null && typeof value === "object") {
		return Object.fromEntries(
			Object.keys(value)
				.sort()
				.map(key => [key, canonical(value[key])])
		)
	}
	return typeof value === "bigint" ? value.toString() : value
}

export async function invalidateCache(redis: ResolverContext["redis"]) {
	if (process.env.CACHING === "false") return
	try {
		await redis.set(revisionKey, randomUUID())
	} catch {
		console.error("Cache invalidation failed")
	}
}

export async function cachingResolver(
	parent: any,
	args: any,
	context: ResolverContext,
	info: any,
	resolver: Function
) {
	// Authenticated and mutation results must not enter the shared public cache.
	if (
		process.env.CACHING === "false" ||
		context.user != null ||
		context.accessToken != null ||
		info.operation?.operation === "mutation"
	) {
		return ((await resolver(parent, args, context)) as QueryResult<any>).data
	}

	let key: string
	try {
		let revision = await context.redis.get(revisionKey)
		if (revision == null) {
			await context.redis.set(revisionKey, randomUUID(), { NX: true })
			revision = await context.redis.get(revisionKey)
		}
		const identity = canonical({
			type: info.parentType.name,
			field: info.fieldName,
			parent: parent?.id ?? parent?.uuid ?? null,
			args
		})
		const digest = createHash("sha256")
			.update(JSON.stringify(identity))
			.digest("hex")
		key = `${prefix}${revision}:${digest}`
		const cached = await context.redis.get(key)
		if (cached != null) return deserialize(Buffer.from(cached, "base64"))
	} catch {
		// Redis and corrupt cache entries must not turn a working query into an error.
		key = undefined
	}

	const result: QueryResult<any> = await resolver(parent, args, context)
	if (key && result.caching) {
		try {
			// V8 serialization preserves Prisma BigInts and Dates on a cache hit.
			await context.redis.set(
				key,
				serialize(result.data).toString("base64"),
				{ EX: ttl }
			)
		} catch {
			/* The database result remains valid if caching fails. */
		}
	}
	return result.data
}
