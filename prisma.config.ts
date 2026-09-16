import "dotenv/config"
import { defineConfig } from "prisma/config"

export default defineConfig({
	schema: "prisma/schema.prisma",
	// Generation also works in CI without database credentials.
	datasource: { url: process.env.DATABASE_URL }
})
