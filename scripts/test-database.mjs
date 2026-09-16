export function getTestDatabaseUrl(value = process.env.TEST_DATABASE_URL) {
	const url = new URL(
		value ??
			"postgresql://pocketlib_test:pocketlib_test@127.0.0.1:55432/pocketlib_test"
	)
	if (
		!["postgresql:", "postgres:"].includes(url.protocol) ||
		!["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) ||
		url.username !== "pocketlib_test" ||
		url.pathname !== "/pocketlib_test" ||
		url.search !== "" ||
		url.hash !== ""
	) {
		throw new Error(
			"Tests require a local pocketlib_test database owned by pocketlib_test, without URL parameters."
		)
	}
	return url.toString()
}
