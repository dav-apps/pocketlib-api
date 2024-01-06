import { PrismaClient } from "@prisma/client"
import axios from "axios"
import { parse } from "node-html-parser"

const prisma = new PrismaClient()
const perPage = 12
const baseUrl = "https://standardebooks.org"

let initialResponse = await axios({
	method: "get",
	url: `https://standardebooks.org/ebooks?per-page=${perPage}`
})

const root = parse(initialResponse.data)

let pagesOl = root.querySelector("nav > ol")
let pages = pagesOl.querySelectorAll("li").length

for (let i = 1; i <= pages; i++) {
	let response = await axios({
		method: "get",
		url: `https://standardebooks.org/ebooks?page=${i}&view=list&per-page=${perPage}`
	})

	let ebooksList = parse(response.data).querySelector("ol.ebooks-list")

	for (let child of ebooksList.querySelectorAll(`li[typeof="schema:Book"]`)) {
		// Get the title
		const titleSpan = child.querySelector(`span[property="schema:name"]`)
		const title = titleSpan.textContent

		// Get the name of the author
		const authorAnchor = child.querySelector("p.author > a")
		const author = authorAnchor.textContent

		// Get the url to the book page
		const titleAnchor = child.querySelector(`a[property="schema:url"]`)
		const url = titleAnchor.getAttribute("href")

		// Get the urls to the cover files
		const jpgSource = child.querySelector(`source[type="image/jpg"]`)
		const jpgSrcSet = jpgSource.getAttribute("srcset")
		let jpgs = jpgSrcSet.split(",")

		if (jpgs.length <= 1) {
			console.log(`${title} (on page ${i}) has only one cover!`)
			continue
		}

		let largeCoverUrl = baseUrl + jpgs[0].trim().split(" ")[0]
		let smallCoverUrl = baseUrl + jpgs[1].trim().split(" ")[0]

		console.log(`${author}: ${title}`)
		saveBook(title, author, url, smallCoverUrl, largeCoverUrl)
		break
	}

	if (i == 1) break
}

async function saveBook(
	title: string,
	author: string,
	url: string,
	smallCoverUrl: string,
	largeCoverUrl: string
) {}
