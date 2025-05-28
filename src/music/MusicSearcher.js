import * as url from 'url'
import { google } from 'googleapis'
import { toSeconds, parse } from 'iso8601-duration'
import config from "../../config.json" with { type: "json" }

const { MAX_SEARCH_RESULTS } = config

const youtube = google.youtube('v3')

const GAPI_KEYS = []

{
    let index = 0
    let lastKey = process.env["GAPI_KEY_" + index]

    while (lastKey) {
        GAPI_KEYS[index] = lastKey
        index++
        lastKey = process.env["GAPI_KEY_" + index]
    }
}

export class MusicSearcher {
    constructor() {
        this._keys = [...GAPI_KEYS]
    }

    search(query, isMultiSearch) {
        const auth = this._nextKey()

        if (!isMultiSearch) {
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
        }

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

    _queryVideos(ids, auth) {
        return youtube.videos.list({
            part: "id,snippet,status,contentDetails",
            id: ids.join(','),
            auth
        }).then(result => {
            const items = result.data.items
                .filter(item => item.status.embeddable && item.contentDetails.contentRating.ytRating !== "ytAgeRestricted")
                .slice(0, MAX_SEARCH_RESULTS)
            
            items.forEach(item => {
                item.seconds = toSeconds(parse(item.contentDetails.duration))
            })
            
            return items
        })
    }

    _nextKey() {
        if (this._keys.length === 0) {
            this._keys = [...GAPI_KEYS]
        }

        return this._keys.splice(Math.floor(this._keys.length * Math.random()), 1)[0]
    }
}