const url = require("url")
const { google } = require("googleapis")

const youtube = google.youtube("v3")

const GAPI_KEYS = []

{ // populate api key rotation array
    let index = 0
    let lastKey = process.env["GAPI_KEY_" + index]

    while (lastKey) {
        GAPI_KEYS[index] = lastKey
        index++
        lastKey = process.env["GAPI_KEY_" + index]
    }
}

class MusicSearcher {

    constructor() {
        this._gapiKeyIndex = Math.floor(GAPI_KEYS.length*Math.random())
    }

    search(query) {
        this._gapiKeyIndex = (this._gapiKeyIndex + 1) % GAPI_KEYS.length
        return this._queryItems(query, GAPI_KEYS[this._gapiKeyIndex])
    }

    _queryItems(query, auth) {
		const q = url.parse(query, true)
	
		if (q.host && q.host.includes("youtube")) {
			if (q.pathname === "/watch" && q.query.v) {
				return this._queryVideos([q.query.v], auth)
			} else if (q.pathname === "/playlist" && q.query.list) {
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

		return youtube.search.list({
			maxResults: 1,
			part: "id",
			q: query,
			type: "video",
			videoEmbeddable: "true",
			safeSearch: "strict",
            auth
		}).then(result => this._queryVideos(result.data.items.map(item => item.id.videoId), auth))
	}

	_queryVideos(ids, auth) {
		return youtube.videos.list({
			part: "id,snippet,status,contentDetails",
			id: ids.join(','),
            auth
		}).then(result => result.data.items)
	}
}

module.exports = MusicSearcher