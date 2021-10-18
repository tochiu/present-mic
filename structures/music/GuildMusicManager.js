const { toSeconds, parse } = require("iso8601-duration")
const { joinVoiceChannel, getVoiceConnection } = require('@discordjs/voice')

const MusicSearcher = require("./MusicSearcher")
const MusicPlayer = require("./MusicPlayer")

const { maxQueueItems } = require("../../config.json")

const MEMBER_VOICE_CHANNEL_STATE = {
    JOINING: 0,
    LEAVING: 1,
    CHANGING: 2
}

const EMPTY_STATE = { 
	playing: undefined, 
	queue: [] 
}

class GuildMusicManager {

	constructor(guild, client) {
		this.guild = guild
		this.client = client

		this._searcher = new MusicSearcher()
		this._player = undefined

		const connection = getVoiceConnection(guild.id)
        if (connection) {
            connection.destroy()
        }
	}
	
	async play(query, channel, requester) {
		const player = this._getMusicPlayer(channel)
		if (!player) {
			return {
				success: false,
				reason: "What'cha doin' asking for tunes? :face_with_raised_eyebrow: You're not even in a voice channel!"
			}
		}

		console.log(`Searching: ${query}`)

		/* check if theres space before querying */
		let maxItems = maxQueueItems - player.getState().queue.length
		if (maxItems <= 0) {
			return {
				success: false,
				reason: `The queue already contains \`${maxQueueItems}\` performances! :fearful:  Use \`/remove\` or \`/clear\` if you really want to make space`
			}
		}

		let items
		try {
			items = (await this._searcher.search(query)).filter(item => item.status.embeddable && item.contentDetails.contentRating.ytRating !== "ytAgeRestricted")
		} catch(e) {
			console.error(e)
			return {
				success: false,
				reason: `I came across an issue searchin' for \`${query}\` :man_shrugging:`
			}
		}

		/* update space remaining since we awaited for the search query to complete */
		maxItems = maxQueueItems - player.getState().queue.length
		if (maxItems <= 0) {
			return {
				success: false,
				reason: `The queue already contains \`${maxQueueItems}\` performances! :fearful:  Use \`/remove\` or \`/clear\` if you really want to make space`
			}
		}

		if (items.length > 0) {
			if (items.length > maxItems) {
				items.splice(maxItems, items.length - maxItems)
			}
			
			const state = player.getState()
			const playingBefore = state.playing
			const queueBefore = state.queue
			const playingBeforeTimestamp = state.playTimestamp

			for (const item of items) {

				console.log(`Found "${item.snippet.title}" - link: https://www.youtube.com/watch?v=${item.id}`)

				item.requester = requester
				item.seconds = toSeconds(parse(item.contentDetails.duration))
			}
			
			player.enqueue(items)

			if (await player.processQueue()) {
				return { 
					success: true,
	
					isPlayingNow: !playingBefore && queueBefore.length === 0,
					
					currentDurationLeft: playingBefore && playingBeforeTimestamp ? Math.max(0, playingBefore.seconds - (Date.now() - playingBeforeTimestamp)/1000) : 0,
					queueBeforeDuration: queueBefore.reduce((duration, item) => duration + item.seconds, 0),
	
					itemsStart: queueBefore.length,
					itemsDuration: items.reduce((duration, item) => duration + item.seconds, 0),
					items
				}
			} else {
				return { 
					success: false, 
					reason: `I came across an issue queueing up your result${items.length > 1 ? "s" : ""} for playback! :man_shrugging:` 
				}
			}
		} else {
			console.log(`No results found!`)
			return {
				success: false,
				reason: "I got nothin'! :person_shrugging: Ain't find squat! :pinching_hand: You must be into weird stuff, huh?"
			}
		}
	}

	getState() {
		const player = this._getMusicPlayer()
		return player ? player.getState() : EMPTY_STATE
	}

	remove(spliceList) {
		const player = this._getMusicPlayer()
		return player ? player.remove(spliceList) : []
	}

	skip() {
		const player = this._getMusicPlayer()
		if (player) {
			player.skip()
		}
	}

	clear() {
		console.log("Clearing")
		const player = this._getMusicPlayer()
		if (player) {
			player.clear()
		}
	}

	updateMemberVoiceState(oldState, newState) {
        if (!oldState) {
            oldState = {
                channelId: undefined
            }
        }
        if (newState.channelId === oldState.channelId) {
            return
        }
        
        let channelState = 
            (!oldState.channelId ? MEMBER_VOICE_CHANNEL_STATE.JOINING :
                (!newState.channelId ? MEMBER_VOICE_CHANNEL_STATE.LEAVING :
                    MEMBER_VOICE_CHANNEL_STATE.CHANGING)) 
        
        let isLeaveAction = 
            channelState === MEMBER_VOICE_CHANNEL_STATE.LEAVING || 
            channelState === MEMBER_VOICE_CHANNEL_STATE.CHANGING
        
        if (newState.member.user.id === this.client.user.id) {
            if (isLeaveAction) {
                this._updateClientVoiceStateLeave()
            }
        }
    }

	_updateClientVoiceStateLeave() {
        this.clear()
    }

	_getMusicPlayer(channel) {
		let connection = getVoiceConnection(this.guild.id)
		if (!connection) {
			if (channel) {
				connection = joinVoiceChannel({
					channelId: channel.id,
					guildId: channel.guild.id,
					adapterCreator: channel.guild.voiceAdapterCreator,
				})
				connection.on("error", console.error)
			} else {
				return
			}
		}

		let player = this._player
		if (!player || player.getVoiceConnection() !== connection) {
			if (player) {
				player.destroy()
			}

			player = new MusicPlayer(connection)
			this._player = player
		}

		return player
	}
}

module.exports = GuildMusicManager