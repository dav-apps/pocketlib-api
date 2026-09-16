import { createClient } from "redis"
import { getTestRedisUrl } from "../../scripts/test-redis.mjs"

export function testRedis() {
	return createClient({
		url: getTestRedisUrl(),
		socket: { reconnectStrategy: false }
	})
}

export async function clearTestCache(redis: ReturnType<typeof testRedis>) {
	// The connection has already been restricted to the isolated test Redis.
	for await (const keys of redis.scanIterator({
		MATCH: "pocketlib:cache:v2:*"
	})) {
		if (keys.length > 0) await redis.del(keys)
	}
}
