import { PrismaClient } from "@prisma/client"
import { listTableObjects } from "./services/apiService.js"

const prisma = new PrismaClient()
const limit = 1000

async function migrateCategoryNames() {
	let tableObjectsResponse = await listTableObjects({
		tableName: "CategoryName",
		limit
	})

	let categoriesResponse = await listTableObjects({
		tableName: "Category",
		limit
	})

	for (let tableObject of tableObjectsResponse.items) {
		console.log(tableObject.uuid)

		// Find the Category of the name
		let category = null

		for (let categoryTableObject of categoriesResponse.items) {
			let names = categoryTableObject.properties.names as string

			if (names != null && names.includes(tableObject.uuid)) {
				category = await prisma.category.findFirst({
					where: { uuid: categoryTableObject.uuid }
				})

				break
			}
		}

		if (category != null) {
			await prisma.categoryName.create({
				data: {
					uuid: tableObject.uuid,
					category: {
						connect: {
							id: category.id
						}
					},
					name: tableObject.properties.name as string,
					language: tableObject.properties.language as string
				}
			})
		}
	}
}

async function migrateCategories() {
	let tableObjectsResponse = await listTableObjects({
		tableName: "Category",
		limit
	})

	let storeBookReleasesResponse = await listTableObjects({
		tableName: "StoreBookRelease",
		limit
	})

	for (let tableObject of tableObjectsResponse.items) {
		console.log(tableObject.uuid)

		// Find the StoreBookRelease of the category
		let storeBookReleases = []

		for (let storeBookReleaseTableObject of storeBookReleasesResponse.items) {
			let categories = storeBookReleaseTableObject.properties
				.categories as string

			if (categories != null && categories.includes(tableObject.uuid)) {
				storeBookReleases.push(
					await prisma.storeBookRelease.findFirst({
						where: { uuid: storeBookReleaseTableObject.uuid }
					})
				)
			}
		}

		let data = {
			uuid: tableObject.uuid,
			releases: {
				connect: []
			},
			key: tableObject.properties.key as string
		}

		for (let storeBookRelease of storeBookReleases) {
			data.releases.connect.push({
				id: storeBookRelease.id
			})
		}

		await prisma.category.create({
			data
		})
	}
}

async function migrateStoreBookFiles() {
	let tableObjectsResponse = await listTableObjects({
		tableName: "StoreBookFile",
		limit
	})

	let storeBookReleasesResponse = await listTableObjects({
		tableName: "StoreBookRelease",
		limit
	})

	for (let tableObject of tableObjectsResponse.items) {
		console.log(tableObject.uuid)

		// Find the StoreBookRelease of the file
		let storeBookRelease = null

		for (let storeBookReleaseTableObject of storeBookReleasesResponse.items) {
			if (storeBookReleaseTableObject.properties.file == tableObject.uuid) {
				storeBookRelease = await prisma.storeBookRelease.findFirst({
					where: { uuid: storeBookReleaseTableObject.uuid }
				})

				break
			}
		}

		if (storeBookRelease != null) {
			await prisma.storeBookFile.create({
				data: {
					uuid: tableObject.uuid,
					release: {
						connect: {
							id: storeBookRelease.id
						}
					},
					fileName: tableObject.properties.file_name as string
				}
			})
		}
	}
}

async function migrateStoreBookCovers() {
	let tableObjectsResponse = await listTableObjects({
		tableName: "StoreBookCover",
		limit
	})

	let storeBookReleasesResponse = await listTableObjects({
		tableName: "StoreBookRelease",
		limit
	})

	for (let tableObject of tableObjectsResponse.items) {
		console.log(tableObject.uuid)

		// Find the StoreBookRelease of the cover
		let storeBookRelease = null

		for (let storeBookReleaseTableObject of storeBookReleasesResponse.items) {
			if (storeBookReleaseTableObject.properties.cover == tableObject.uuid) {
				storeBookRelease = await prisma.storeBookRelease.findFirst({
					where: { uuid: storeBookReleaseTableObject.uuid }
				})

				break
			}
		}

		if (storeBookRelease != null) {
			await prisma.storeBookCover.create({
				data: {
					uuid: tableObject.uuid,
					release: {
						connect: {
							id: storeBookRelease.id
						}
					},
					aspectRatio: tableObject.properties.aspect_ratio as string,
					blurhash: tableObject.properties.blurhash as string
				}
			})
		}
	}
}

async function migrateStoreBookReleases() {
	let tableObjectsResponse = await listTableObjects({
		tableName: "StoreBookRelease",
		limit
	})

	let storeBooksResponse = await listTableObjects({
		tableName: "StoreBook",
		limit
	})

	for (let tableObject of tableObjectsResponse.items) {
		// Check if the StoreBookRelease already exists
		let storeBookRelease = await prisma.storeBookRelease.findFirst({
			where: { uuid: tableObject.uuid }
		})
		if (storeBookRelease != null) continue

		console.log(tableObject.uuid)

		// Find the StoreBook of the StoreBookRelease
		let storeBook = null

		for (let storeBookTableObject of storeBooksResponse.items) {
			let releases = storeBookTableObject.properties.releases as string

			if (releases != null && releases.includes(tableObject.uuid)) {
				storeBook = await prisma.storeBook.findFirst({
					where: { uuid: storeBookTableObject.uuid }
				})

				break
			}
		}

		if (storeBook != null) {
			let publishedAtString = tableObject.properties.published_at as string
			let publishedAt = null

			if (publishedAtString != null) {
				publishedAt = new Date(+publishedAtString * 1000)
			}

			await prisma.storeBookRelease.create({
				data: {
					uuid: tableObject.uuid,
					storeBook: {
						connect: { id: storeBook.id }
					},
					releaseName: tableObject.properties.release_name as string,
					releaseNotes: tableObject.properties.release_notes as string,
					publishedAt,
					title: tableObject.properties.title as string,
					description: tableObject.properties.description as string,
					price: +tableObject.properties.price,
					isbn: tableObject.properties.isbn as string,
					status:
						(tableObject.properties.status as string) || "unpublished"
				}
			})
		}
	}
}

async function migrateStoreBooks() {
	let tableObjectsResponse = await listTableObjects({
		tableName: "StoreBook",
		limit
	})

	let storeBookCollectionsResponse = await listTableObjects({
		tableName: "StoreBookCollection",
		limit
	})

	let storeBookSeriesResponse = await listTableObjects({
		tableName: "StoreBookSeries",
		limit
	})

	for (let tableObject of tableObjectsResponse.items) {
		console.log(tableObject.uuid)

		// Check if the StoreBook already exists
		let storeBook = await prisma.storeBook.findFirst({
			where: { uuid: tableObject.uuid }
		})
		if (storeBook != null) continue

		// Find the StoreBookCollection of the StoreBook
		let collection = null

		for (let collectionTableObject of storeBookCollectionsResponse.items) {
			let books = collectionTableObject.properties.books as string

			if (books != null && books.includes(tableObject.uuid)) {
				collection = await prisma.storeBookCollection.findFirst({
					where: { uuid: collectionTableObject.uuid }
				})

				break
			}
		}

		// Find the StoreBookSeries of the StoreBook
		let storeBookSeries = null

		for (let seriesTableObject of storeBookSeriesResponse.items) {
			let storeBooks = seriesTableObject.properties.store_books as string

			if (storeBooks != null && storeBooks.includes(tableObject.uuid)) {
				storeBookSeries = await prisma.storeBookSeries.findFirst({
					where: { uuid: seriesTableObject.uuid }
				})

				break
			}
		}

		if (collection != null) {
			let data = {
				uuid: tableObject.uuid,
				collectionId: collection.id,
				language: tableObject.properties.language as string,
				status: (tableObject.properties.status as string) || "unpublished"
			}

			if (storeBookSeries != null) {
				data["series"] = {
					connect: {
						id: storeBookSeries.id
					}
				}
			}

			await prisma.storeBook.create({ data })
		}
	}
}

async function migrateStoreBookSeries() {
	let tableObjectsResponse = await listTableObjects({
		tableName: "StoreBookSeries",
		limit
	})

	let authorsResponse = await listTableObjects({
		tableName: "Author",
		limit
	})

	for (let tableObject of tableObjectsResponse.items) {
		console.log(tableObject.uuid)

		// Find the author of the store book collection
		let author = null

		for (let authorTableObject of authorsResponse.items) {
			let series = authorTableObject.properties.series as string

			if (series != null && series.includes(tableObject.uuid)) {
				author = await prisma.author.findFirst({
					where: { uuid: authorTableObject.uuid }
				})

				break
			}
		}

		if (author != null) {
			await prisma.storeBookSeries.create({
				data: {
					uuid: tableObject.uuid,
					authorId: author.id,
					name: tableObject.properties.name as string,
					language: tableObject.properties.language as string
				}
			})
		}
	}
}

async function migrateStoreBookCollectionNames() {
	let tableObjectsResponse = await listTableObjects({
		tableName: "StoreBookCollectionName",
		limit
	})

	let storeBookCollectionsResponse = await listTableObjects({
		tableName: "StoreBookCollection",
		limit
	})

	for (let tableObject of tableObjectsResponse.items) {
		console.log(tableObject.uuid)

		// Find the StoreBookCollection of the name
		let storeBookCollection = null

		for (let storeBookCollectionTableObject of storeBookCollectionsResponse.items) {
			let names = storeBookCollectionTableObject.properties.names as string

			if (names != null && names.includes(tableObject.uuid)) {
				storeBookCollection = await prisma.storeBookCollection.findFirst({
					where: { uuid: storeBookCollectionTableObject.uuid }
				})

				break
			}
		}

		if (storeBookCollection != null) {
			await prisma.storeBookCollectionName.create({
				data: {
					uuid: tableObject.uuid,
					collectionId: storeBookCollection.id,
					name: tableObject.properties.name as string,
					language: tableObject.properties.language as string
				}
			})
		}
	}
}

async function migrateStoreBookCollections() {
	let tableObjectsResponse = await listTableObjects({
		tableName: "StoreBookCollection",
		limit
	})

	let authorsResponse = await listTableObjects({
		tableName: "Author",
		limit
	})

	for (let tableObject of tableObjectsResponse.items) {
		console.log(tableObject.uuid)

		// Find the author of the store book collection
		let author = null

		for (let authorTableObject of authorsResponse.items) {
			let collections = authorTableObject.properties.collections as string

			if (collections != null && collections.includes(tableObject.uuid)) {
				author = await prisma.author.findFirst({
					where: { uuid: authorTableObject.uuid }
				})

				break
			}
		}

		if (author != null) {
			await prisma.storeBookCollection.create({
				data: {
					uuid: tableObject.uuid,
					authorId: author.id
				}
			})
		}
	}
}

async function migrateAuthorBios() {
	let tableObjectsResponse = await listTableObjects({
		tableName: "AuthorBio",
		limit
	})

	let authorsResponse = await listTableObjects({
		tableName: "Author",
		limit
	})

	for (let tableObject of tableObjectsResponse.items) {
		console.log(tableObject.uuid)

		// Find the author of the bio
		let author = null

		for (let authorTableObject of authorsResponse.items) {
			let bios = authorTableObject.properties.bios as string

			if (bios != null && bios.includes(tableObject.uuid)) {
				author = await prisma.author.findFirst({
					where: { uuid: authorTableObject.uuid }
				})

				break
			}
		}

		if (author != null) {
			await prisma.authorBio.create({
				data: {
					uuid: tableObject.uuid,
					authorId: author.id,
					bio: tableObject.properties.bio as string,
					language: tableObject.properties.language as string
				}
			})
		}
	}
}

async function migrateAuthorProfileImages() {
	let tableObjectsResponse = await listTableObjects({
		tableName: "AuthorProfileImage",
		limit
	})

	let authorsResponse = await listTableObjects({
		tableName: "Author",
		limit
	})

	for (let tableObject of tableObjectsResponse.items) {
		console.log(tableObject.uuid)

		// Find the author of the profile image
		let author = null

		for (let authorTableObject of authorsResponse.items) {
			if (authorTableObject.properties.profile_image == tableObject.uuid) {
				author = await prisma.author.findFirst({
					where: { uuid: authorTableObject.uuid }
				})

				break
			}
		}

		if (author != null) {
			await prisma.authorProfileImage.create({
				data: {
					uuid: tableObject.uuid,
					authorId: author.id,
					blurhash: tableObject.properties.blurhash as string
				}
			})
		}
	}
}

async function migrateAuthors() {
	const limit = 10
	let currentPosition = 0
	let total = 0

	do {
		console.log("------------------")
		console.log({ currentPosition })

		let tableObjectsResponse = await listTableObjects({
			tableName: "Author",
			limit,
			offset: currentPosition
		})

		total = tableObjectsResponse.total

		for (let tableObject of tableObjectsResponse.items) {
			console.log(tableObject.uuid)

			// Check if the author already exists
			let author = await prisma.author.findFirst({
				where: { uuid: tableObject.uuid }
			})
			if (author != null) continue

			let publisherUuid = tableObject.properties.publisher as string
			let publisher = null

			if (publisherUuid != null) {
				// Get the publisher
				publisher = await prisma.publisher.findFirst({
					where: { uuid: publisherUuid }
				})
			}

			await prisma.author.create({
				data: {
					uuid: tableObject.uuid,
					publisherId: publisher && publisher.id,
					firstName: tableObject.properties.first_name as string,
					lastName: tableObject.properties.last_name as string,
					websiteUrl: tableObject.properties.website_url as string,
					facebookUsername: tableObject.properties
						.facebook_username as string,
					instagramUsername: tableObject.properties
						.instagram_username as string,
					twitterUsername: tableObject.properties
						.twitter_username as string
				}
			})
		}

		currentPosition += limit
	} while (currentPosition < total)
}

async function migratePublisherLogos() {
	let tableObjectsResponse = await listTableObjects({
		tableName: "PublisherLogo",
		limit
	})

	let publisherResponse = await listTableObjects({
		tableName: "Publisher",
		limit
	})

	for (let tableObject of tableObjectsResponse.items) {
		// Find the publisher of the logo
		let publisher = null

		for (let publisherTableObject of publisherResponse.items) {
			if (publisherTableObject.properties.logo == tableObject.uuid) {
				publisher = await prisma.publisher.findFirst({
					where: { uuid: publisherTableObject.uuid }
				})

				break
			}
		}

		if (publisher != null) {
			await prisma.publisherLogo.create({
				data: {
					uuid: tableObject.uuid,
					publisherId: publisher.id,
					blurhash: tableObject.properties.blurhash as string
				}
			})
		}
	}
}

async function migratePublishers() {
	let tableObjectsResponse = await listTableObjects({
		tableName: "Publisher",
		limit
	})

	for (let tableObject of tableObjectsResponse.items) {
		await prisma.publisher.create({
			data: {
				uuid: tableObject.uuid,
				name: tableObject.properties.name as string,
				description: tableObject.properties.description as string,
				websiteUrl: tableObject.properties.website_url as string,
				facebookUsername: tableObject.properties
					.facebook_username as string,
				instagramUsername: tableObject.properties
					.instagram_username as string,
				twitterUsername: tableObject.properties.twitter_username as string
			}
		})
	}
}
