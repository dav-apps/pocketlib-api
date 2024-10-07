import { PrismaClient } from "@prisma/client"
import { stringToSlug, getLastReleaseOfStoreBook } from "./utils.js"

const prisma = new PrismaClient()

async function generateSlugsForPublishers() {
	let allPublishers = await prisma.publisher.findMany({
		where: { slug: null }
	})

	for (let publisher of allPublishers) {
		let slug = stringToSlug(`${publisher.name} ${publisher.uuid}`)
		console.log(slug)

		await prisma.publisher.update({
			where: { id: publisher.id },
			data: { slug }
		})
	}
}

async function generateSlugsForAuthors() {
	let allAuthors = await prisma.author.findMany({
		where: { slug: null }
	})

	for (let author of allAuthors) {
		let slug = stringToSlug(
			`${author.firstName} ${author.lastName} ${author.uuid}`
		)
		console.log(slug)

		await prisma.author.update({
			where: { id: author.id },
			data: { slug }
		})
	}
}

async function generateSlugsForStoreBooks() {
	let allStoreBooks = await prisma.storeBook.findMany({
		where: { slug: null }
	})

	for (let storeBook of allStoreBooks) {
		let release = await getLastReleaseOfStoreBook(prisma, storeBook.id, true)
		let title = storeBook.uuid

		if (release != null) {
			title = release.title
		}

		let collection = await prisma.storeBookCollection.findFirst({
			where: {
				id: storeBook.collectionId
			}
		})

		let author = await prisma.author.findFirst({
			where: {
				id: collection.authorId
			}
		})

		let slug = stringToSlug(
			`${author.firstName} ${author.lastName} ${title} ${storeBook.uuid}`
		)
		console.log(slug)

		await prisma.storeBook.update({
			where: { id: storeBook.id },
			data: { slug }
		})
	}
}
