import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "./generated/prisma/client.js"

export function createPrismaClient(connectionString = process.env.DATABASE_URL) {
	if (!connectionString) throw new Error("DATABASE_URL is required")

	const schema = new URL(connectionString).searchParams.get("schema") ?? "public"
	const adapter = new PrismaPg(
		{ connectionString, connectionTimeoutMillis: 5000 },
		{ schema }
	)
	return new PrismaClient({ adapter })
}
