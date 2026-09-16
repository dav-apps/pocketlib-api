import { expect, it } from "vitest"
import { getTestDatabaseUrl } from "../../scripts/test-database.mjs"

it.each([
	"postgresql://pocketlib_test:password@production.example/pocketlib_test",
	"postgresql://pocketlib_test:password@localhost/pocketlib",
	"postgresql://postgres:password@localhost/pocketlib_test",
	"postgresql://pocketlib_test:password@localhost/pocketlib_test?schema=production",
	"postgresql://pocketlib_test:password@localhost/pocketlib_test?host=production.example"
])("refuses unsafe database configuration %s", url => {
	expect(() => getTestDatabaseUrl(url)).toThrow(
		"Tests require a local pocketlib_test"
	)
})

it("accepts a dedicated local test database on a custom port", () => {
	const url = "postgresql://pocketlib_test:test@127.0.0.1:55433/pocketlib_test"
	expect(getTestDatabaseUrl(url)).toBe(url)
})
