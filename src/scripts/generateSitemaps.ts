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

	const maxUrlsPerSitemap = 2000
	const websiteUrl = getWebsiteBaseUrl()

	// Base urls
	currentSitemap += `${websiteUrl}\n`
	currentSitemap += `${websiteUrl}/store`

	// Publishers
	let publishers = await prisma.publisher.findMany({
		orderBy: { id: "asc" }
	})

	for (let publisher of publishers) {
		if (urlCount >= maxUrlsPerSitemap) {
			sitemaps.push(currentSitemap)
			currentSitemap = ""
			urlCount = 0
		} else {
			currentSitemap += "\n"
		}

		currentSitemap += `${websiteUrl}/store/publisher/${publisher.slug}`
		urlCount++
	}

	// Authors
	let authors = await prisma.author.findMany({
		orderBy: { id: "asc" }
	})

	for (let author of authors) {
		if (urlCount >= maxUrlsPerSitemap) {
			sitemaps.push(currentSitemap)
			currentSitemap = ""
			urlCount = 0
		} else {
			currentSitemap += "\n"
		}

		currentSitemap += `${websiteUrl}/store/author/${author.slug}`
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
		} else {
			currentSitemap += "\n"
		}

		currentSitemap += `${websiteUrl}/store/author/${vlbAuthor.slug}`
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
		} else {
			currentSitemap += "\n"
		}

		currentSitemap += `${websiteUrl}/store/book/${storeBook.slug}`
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
		} else {
			currentSitemap += "\n"
		}

		currentSitemap += `${websiteUrl}/store/book/${vlbItem.slug}`
		urlCount++
	}

	sitemaps.push(currentSitemap)

	// Write the sitemaps to the file system
	for (let i = 0; i < sitemaps.length; i++) {
		fs.writeFileSync(`./sitemaps/sitemap-${i}.txt`, sitemaps[i])
	}
}
