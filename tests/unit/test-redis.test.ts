import { expect, it } from "vitest"
import { getTestRedisUrl } from "../../scripts/test-redis.mjs"

it.each([
	"redis://:pocketlib_test@production.example/15",
	"redis://:pocketlib_test@localhost/0",
	"redis://:production@localhost/15",
	"redis://:pocketlib_test@localhost/15?db=0",
	"redis://:pocketlib_test@localhost/15#other",
	"https://:pocketlib_test@localhost/15"
])("refuses unsafe Redis configuration %s", url => {
	expect(() => getTestRedisUrl(url)).toThrow(
		"Tests require a local Redis database 15"
	)
})

it("accepts dedicated local test Redis on a custom port", () => {
	const url = "redis://:pocketlib_test@127.0.0.1:56380/15"
	expect(getTestRedisUrl(url)).toBe(url)
})
