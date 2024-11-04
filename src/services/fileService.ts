import {
	HeadObjectCommand,
	PutObjectCommand,
	S3Client
} from "@aws-sdk/client-s3"

const s3Client = new S3Client({
	endpoint: "https://fra1.digitaloceanspaces.com",
	forcePathStyle: false,
	region: "fra1",
	credentials: {
		accessKeyId: process.env.SPACES_ACCESS_KEY,
		secretAccessKey: process.env.SPACES_SECRET
	}
})

export async function check(key: string): Promise<boolean> {
	try {
		await s3Client.send(
			new HeadObjectCommand({
				Bucket: "pocketlib",
				Key: key
			})
		)

		return true
	} catch (error) {
		return false
	}
}

export async function upload(key: string, body: any, contentType?: string) {
	try {
		await s3Client.send(
			new PutObjectCommand({
				Bucket: "pocketlib",
				Key: key,
				Body: body,
				ACL: "public-read",
				ContentType: contentType
			})
		)

		return getFileLink(key)
	} catch (err) {
		console.log("Error", err)
		return null
	}
}

export function getFileLink(key: string) {
	return `https://pocketlib.fra1.cdn.digitaloceanspaces.com/${key}`
}
