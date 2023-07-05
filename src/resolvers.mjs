import axios from "axios"

export const resolvers = {
	Query: {
		allPublishers: async () => {
			try {
				let response = await axios({
					method: "get",
					url: "http://localhost:3111/v2/table_objects",
					params: {
						table_name: "Publisher"
					}
				})

				let result = []

				for (let obj of response.data.table_objects) {
					result.push({
						uuid: obj.uuid,
						name: obj.properties.name,
						description: obj.properties.description,
						websiteUrl: obj.properties.website_url,
						facebookUsername: obj.properties.facebook_username,
						instagramUsername: obj.properties.instagram_username,
						twitterUsername: obj.properties.twitter_username,
						logo: obj.properties.logo,
						authors: obj.properties.authors
					})
				}

				return result
			} catch (error) {
				console.error(error.response.data)
				return []
			}
		},
		allAuthors: async () => {
			try {
				let response = await axios({
					method: "get",
					url: "http://localhost:3111/v2/table_objects",
					params: {
						table_name: "Author"
					}
				})

				let result = []

				for (let obj of response.data.table_objects) {
					result.push({
						uuid: obj.uuid,
						firstName: obj.properties.first_name,
						lastName: obj.properties.last_name,
						websiteUrl: obj.properties.website_url,
						facebookUsername: obj.properties.facebook_username,
						instagramUsername: obj.properties.instagram_username,
						twitterUsername: obj.properties.twitter_username
					})
				}

				return result
			} catch (error) {
				console.error(error.response.data)
				return []
			}
		}
	},
	Publisher: {
		logo: async publisher => {
			if (publisher.logo == null) {
				return null
			}

			try {
				let response = await axios({
					method: "get",
					url: `http://localhost:3111/v2/table_objects/${publisher.logo}`
				})

				return {
					uuid: response.data.uuid,
					url: `https://dav-backend-dev.fra1.cdn.digitaloceanspaces.com/${response.data.uuid}`,
					blurhash: response.data.blurhash
				}
			} catch (error) {
				console.error(error.response.data)
				return null
			}
		},
		authors: async publisher => {
			if (publisher.authors == null) {
				return []
			}

			let authorUuids = publisher.authors.split(",")
			let authors = []

			for (let uuid of authorUuids) {
				try {
					let response = await axios({
						method: "get",
						url: `http://localhost:3111/v2/table_objects/${uuid}`
					})

					authors.push({
						uuid: response.data.uuid,
						firstName: response.data.properties.first_name,
						lastName: response.data.properties.last_name,
						websiteUrl: response.data.properties.website_url,
						facebookUsername: response.data.properties.facebook_username,
						instagramUsername:
							response.data.properties.instagram_username,
						twitterUsername: response.data.properties.twitter_username
					})
				} catch (error) {
					console.error(error.response.data)
				}
			}

			return authors
		}
	}
}
