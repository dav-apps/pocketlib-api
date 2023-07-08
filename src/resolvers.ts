import { Publisher, Author, Category, CategoryName } from "./types.js"
import {
	convertTableObjectToPublisher,
	convertTableObjectToPublisherLogo,
	convertTableObjectToCategory,
	convertTableObjectToCategoryName
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
		},
		listCategories: async (parent: any, args: { language?: string }) => {
			let tableObjects = await listTableObjects({
				tableName: "Category"
			})

			let result: Category[] = []

			for (let obj of tableObjects) {
				result.push(convertTableObjectToCategory(obj))
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
	},
	Category: {
		name: async (category: Category, args: any, context: any, info: any) => {
			const namesString = category.names as string

			if (namesString == null) {
				return null
			}

			// Get all names
			let nameUuids = namesString.split(",")
			let names: CategoryName[] = []

			for (let uuid of nameUuids) {
				let nameObj = await getTableObject(uuid)
				if (nameObj == null) continue

				names.push(convertTableObjectToCategoryName(nameObj))
			}

			// Get the optimal name for the given language
			let language = info?.variableValues?.language || "en"
			let name = names.find(n => n.language == language)

			if (name != null) {
				return name
			}

			name = names.find(n => n.language == "en")

			if (name != null) {
				return name
			}

			return names[0]
		}
	}
}
