const url = require("url")
const { google } = require("googleapis")
const { toSeconds, parse } = require("iso8601-duration")

const youtube = google.youtube("v3")

const GAPI_KEYS = []

/* populate api key rotation array */
{
	let index = 0
	let lastKey = process.env["GAPI_KEY_" + index]

	while (lastKey) {
		GAPI_KEYS[index] = lastKey
		index++
		lastKey = process.env["GAPI_KEY_" + index]
	}
}

/**
 * Music Searcher
 * This class juggles Google API Keys provided in the environment to request for results from YouTube
 * 
 * TODO: detect when an api key has reached its qouta limit and remove it from the rotation
 */
class MusicSearcher {

	constructor() {
		this._keys = [...GAPI_KEYS]
	}

	/*
		search YouTube for results given a query string
	*/
	search(query, isMultiSearch) {
		const auth = this._nextKey()

		if (!isMultiSearch) {
			/* attempt to parse the query as a url */
			const q = url.parse(query, true)

			/* parse as YouTube url if url.parse detects youtube in the hostname */
			if (q.host && q.host.includes("youtube")) {
				if (q.pathname === "/watch" && q.query.v) {
					/* query specific YouTube video url */
					return this._queryVideos([q.query.v], auth)
				} else if (q.pathname === "/playlist" && q.query.list) {
					/* query playlist items and convert those to YouTube video urls */
					return youtube.playlistItems.list({
						part: "snippet",
						playlistId: q.query.list,
						maxResults: 50,
						auth
					}).then(result => this._queryVideos(
						result.data.items
							.filter(item => item.snippet.resourceId.videoId)
							.map(item => item.snippet.resourceId.videoId),
						auth
					))
				}
			}
		}

		/* parse as YouTube search  */
		return youtube.search.list({
			maxResults: isMultiSearch ? 50 : 1,
			part: "id",
			q: query,
			type: "video",
			videoEmbeddable: "true",
			safeSearch: "strict",
			auth
		}).then(result => this._queryVideos(result.data.items.map(item => item.id.videoId), auth))
	}

	/* 
		query video data from YouTube 
	*/
	_queryVideos(ids, auth) {
		return youtube.videos.list({
			part: "id,snippet,status,contentDetails",
			id: ids.join(','),
			auth
		}).then(result => {
			const items = result.data.items
				.filter(item => item.status.embeddable && item.contentDetails.contentRating.ytRating !== "ytAgeRestricted")
				.slice(0, 25)
			
			items.forEach(item => {
				item.seconds = toSeconds(parse(item.contentDetails.duration))
			})
			
			return items
		})
	}

	/* 
		extract a random api key from the unused key set, replenish if empty 
	*/
	_nextKey() {
		if (this._keys.length === 0) {
			this._keys = [...GAPI_KEYS]
		}

		return this._keys.splice(Math.floor(this._keys.length * Math.random()), 1)[0]
	}
}

module.exports = MusicSearcher