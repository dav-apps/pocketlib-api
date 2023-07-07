import { Publisher, Author } from "./types.js"
import {
	convertTableObjectToPublisher,
	convertTableObjectToPublisherLogo,
	convertTableObjectToAuthor
} from "./utils.js"
import { getTableObject, listTableObjects } from "./services/apiService.js"

export const resolvers = {
	Query: {
		allPublishers: async () => {
			let tableObjects = await listTableObjects({
				tableName: "Publisher"
			})

			let result: Publisher[] = []

			for (let obj of tableObjects) {
				result.push(convertTableObjectToPublisher(obj))
			}

			return result
		},
		allAuthors: async () => {
			let tableObjects = await listTableObjects({
				tableName: "Author"
			})

			let result: Author[] = []

			for (let obj of tableObjects) {
				result.push(convertTableObjectToAuthor(obj))
			}

			return result
		}
	},
	Publisher: {
		logo: async (publisher: Publisher) => {
			const uuid = publisher.logo as string

			if (uuid == null) {
				return null
			}

			let tableObject = await getTableObject(uuid)

			if (tableObject != null) {
				return convertTableObjectToPublisherLogo(tableObject)
			} else {
				return null
			}
		},
		authors: async (publisher: Publisher) => {
			if (publisher.authors == null) {
				return []
			}

			let authorUuids = (publisher.authors as string).split(",")
			let authors: Author[] = []

			for (let uuid of authorUuids) {
				let author = await getTableObject(uuid)
				if (author == null) continue

				authors.push(convertTableObjectToAuthor(author))
			}

			return authors
		}
	}
}
