export function getTestRedisUrl(value = process.env.TEST_REDIS_URL) {
	const url = new URL(value ?? "redis://:pocketlib_test@127.0.0.1:56379/15")
	if (
		url.protocol !== "redis:" ||
		!["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) ||
		url.pathname !== "/15" ||
		url.password !== "pocketlib_test" ||
		url.search ||
		url.hash
	) {
		throw new Error(
			"Tests require a local Redis database 15 with the pocketlib_test password and no URL parameters."
		)
	}
	return url.toString()
}
