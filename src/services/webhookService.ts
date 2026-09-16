import type { PrismaClient, Prisma } from "@prisma/client"

// PostgreSQL locks also serialize deliveries handled by different API processes.
export async function withWebhookLock<T>(
	prisma: PrismaClient,
	key: string,
	work: (tx: Prisma.TransactionClient) => Promise<T>
): Promise<T> {
	return prisma.$transaction(
		async tx => {
			await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))`
			return work(tx)
		},
		{ maxWait: 5000, timeout: 30000 }
	)
}

export async function runWebhookEffectOnce(
	prisma: PrismaClient,
	key: string,
	work: () => Promise<void>
) {
	await withWebhookLock(prisma, key, async tx => {
		if (await tx.webhookEffect.findUnique({ where: { key } })) return
		await work()
		await tx.webhookEffect.create({ data: { key } })
	})
}
