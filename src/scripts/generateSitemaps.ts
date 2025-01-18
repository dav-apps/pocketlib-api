import fs from "fs"
import { PrismaClient } from "@prisma/client"
import {
	websiteBaseUrlDevelopment,
	websiteBaseUrlStaging,
	websiteBaseUrlProduction
} from "../constants.js"

export const prisma = new PrismaClient()

generateSitemaps(prisma)

function getWebsiteBaseUrl() {
	if (process.env.ENV == "production") {
		return websiteBaseUrlProduction
	} else if (process.env.ENV == "staging") {
		return websiteBaseUrlStaging
	} else {
		return websiteBaseUrlDevelopment
	}
}

async function generateSitemaps(prisma: PrismaClient) {
	let sitemaps: string[] = []
	let currentSitemap = ""
	let urlCount = 2

	const maxUrlsPerSitemap = 30000
	const websiteUrl = getWebsiteBaseUrl()

	// Base urls
	currentSitemap += `${websiteUrl}\n`
	currentSitemap += `${websiteUrl}/store\n`

	// Publishers
	let publishers = await prisma.publisher.findMany({
		orderBy: { id: "asc" }
	})

	for (let publisher of publishers) {
		currentSitemap += `${websiteUrl}/store/publisher/${publisher.slug}\n`
		urlCount++
	}

	// Authors
	let authors = await prisma.author.findMany({
		orderBy: { id: "asc" }
	})

	for (let author of authors) {
		currentSitemap += `${websiteUrl}/store/author/${author.slug}\n`
		urlCount++
	}

	// VlbAuthors
	let vlbAuthors = await prisma.vlbAuthor.findMany({
		orderBy: { id: "asc" }
	})

	for (let vlbAuthor of vlbAuthors) {
		if (urlCount >= maxUrlsPerSitemap) {
			sitemaps.push(currentSitemap)
			currentSitemap = ""
			urlCount = 0
		}

		currentSitemap += `${websiteUrl}/store/author/${vlbAuthor.slug}\n`
		urlCount++
	}

	// StoreBooks
	let storeBooks = await prisma.storeBook.findMany({
		orderBy: { id: "asc" }
	})

	for (let storeBook of storeBooks) {
		if (urlCount >= maxUrlsPerSitemap) {
			sitemaps.push(currentSitemap)
			currentSitemap = ""
			urlCount = 0
		}

		currentSitemap += `${websiteUrl}/store/book/${storeBook.slug}\n`
		urlCount++
	}

	// VlbItems
	let vlbItems = await prisma.vlbItem.findMany({
		orderBy: { id: "asc" }
	})

	for (let vlbItem of vlbItems) {
		if (urlCount >= maxUrlsPerSitemap) {
			sitemaps.push(currentSitemap)
			currentSitemap = ""
			urlCount = 0
		}

		currentSitemap += `${websiteUrl}/store/book/${vlbItem.slug}\n`
		urlCount++
	}

	sitemaps.push(currentSitemap)

	// Write the sitemaps to the file system
	for (let i = 0; i < sitemaps.length; i++) {
		fs.writeFileSync(`./sitemaps/sitemap-${i}.txt`, sitemaps[i])
	}
}
