import { randomUUID } from "node:crypto"
import type { PrismaClient } from "../../src/generated/prisma/client.js"

export async function clearBooks(prisma: PrismaClient) {
	await prisma.printOrder.deleteMany()
	await prisma.storeBookRelease.deleteMany()
	await prisma.storeBook.deleteMany()
	await prisma.storeBookCollection.deleteMany()
	await prisma.author.deleteMany()
	await prisma.storeBookCover.deleteMany()
	await prisma.storeBookFile.deleteMany()
	await prisma.storeBookPrintCover.deleteMany()
	await prisma.storeBookPrintFile.deleteMany()
}

export async function seedBook(
	prisma: PrismaClient,
	status = "published",
	releaseStatus = "unpublished"
) {
	const author = await prisma.author.create({
		data: { uuid: randomUUID(), userId: 42n }
	})
	const collection = await prisma.storeBookCollection.create({
		data: { uuid: randomUUID(), userId: 42n, authorId: author.id }
	})
	const book = await prisma.storeBook.create({
		data: {
			uuid: randomUUID(),
			userId: 42n,
			collectionId: collection.id,
			language: "de",
			status
		}
	})
	const cover = await prisma.storeBookCover.create({
		data: { uuid: randomUUID(), userId: 42n }
	})
	const file = await prisma.storeBookFile.create({
		data: { uuid: randomUUID(), userId: 42n }
	})
	const printCover = await prisma.storeBookPrintCover.create({
		data: { uuid: randomUUID(), userId: 42n }
	})
	const printFile = await prisma.storeBookPrintFile.create({
		data: { uuid: randomUUID(), userId: 42n, pages: 100 }
	})
	const release = await prisma.storeBookRelease.create({
		data: {
			uuid: randomUUID(),
			userId: 42n,
			storeBookId: book.id,
			status: releaseStatus,
			title: "Original title",
			description: "A book description",
			price: 999,
			printPrice: 1999,
			coverId: cover.id,
			fileId: file.id,
			printCoverId: printCover.id,
			printFileId: printFile.id,
			publishedAt:
				releaseStatus === "published" ? new Date("2026-01-01") : null
		}
	})
	return { book, release, cover, file, printCover, printFile }
}
