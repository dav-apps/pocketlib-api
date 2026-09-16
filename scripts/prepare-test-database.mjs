import { spawnSync } from "node:child_process"
import { fileURLToPath } from "node:url"
import { getTestDatabaseUrl } from "./test-database.mjs"

// Validate before Prisma can make any schema changes. DATABASE_URL is ignored.
const databaseUrl = getTestDatabaseUrl()
const result = spawnSync(
	process.execPath,
	[
		fileURLToPath(
			new URL("../node_modules/prisma/build/index.js", import.meta.url)
		),
		"db",
		"push",
		"--schema",
		fileURLToPath(new URL("../prisma/schema.prisma", import.meta.url))
	],
	{
		cwd: fileURLToPath(new URL("..", import.meta.url)),
		env: { ...process.env, DATABASE_URL: databaseUrl },
		stdio: "inherit"
	}
)
if (result.error) throw result.error
process.exit(result.status ?? 1)
