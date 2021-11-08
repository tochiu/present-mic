const { Permissions } = require('discord.js')
const { joinVoiceChannel, getVoiceConnection } = require('@discordjs/voice')
const { toSeconds, parse } = require("iso8601-duration")

const MusicSearcher = require("./MusicSearcher")
const MusicPlayer = require("./MusicPlayer")

const { maxQueueItems } = require("../../config.json")

/**
 * A GuildMusicManager exists for each GuildManager. Playback, joining, disconnecting and queue state management for
 * a guild are exclusively executed here.
 */
class GuildMusicManager {

	constructor(guild, client) {
		this.guild = guild
		this.client = client

		this._searcher = new MusicSearcher()
		this._player = undefined

		/* if a voice connection already exists then destroy it */

		const connection = getVoiceConnection(guild.id)
		if (connection) {
			connection.destroy()
		}
	}

	async play(query, channel, requester) {

		console.log(`Searching: ${query}`)

		/* attempt to search using query */
		let items
		try {
			items = await this._searcher.search(query)
		} catch (e) {
			console.error(e)
			return {
				success: false,
				reason: `I came across an issue searchin' for \`${query}\` :man_shrugging:`
			}
		}

		if (items.length > 0) {
			/* check if we can play tracks */
			const canPlayResult = this.canPlay(channel)
			if (!canPlayResult.success) {
				return canPlayResult
			}

			const player = this._getMusicPlayer(channel)
			const maxItems = maxQueueItems - player.getState().queue.length

			/* cut items over the maxQueueItem limit */
			if (items.length > maxItems) {
				items.splice(maxItems, items.length - maxItems)
			}

			const state = player.getState()
			const playingBefore = state.playing
			const queueBefore = state.queue
			const playingBeforeTimestamp = state.playTimestamp

			/* attach additional data to each item */
			for (const item of items) {

				console.log(`Found "${item.snippet.title}" - link: https://www.youtube.com/watch?v=${item.id}`)

				item.requester = requester
				item.seconds = toSeconds(parse(item.contentDetails.duration))
			}

			/* queue items and get the process result */
			if (await player.enqueue(items).processing) {
				return {
					success: true,

					isPlayingNow: !playingBefore && queueBefore.length === 0,

					currentDurationLeft: playingBefore && playingBeforeTimestamp ? Math.max(0, playingBefore.seconds - (Date.now() - playingBeforeTimestamp) / 1000) : 0,
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

	canPlay(channel) {
		const player = this._getMusicPlayer()
		if (player) {
			/* can't play if the queue is full */
			if (maxQueueItems - player.getState().queue.length <= 0) {
				return {
					success: false,
					reason: `The queue already contains \`${maxQueueItems}\` performances! :fearful:  Use \`/remove\` or \`/clear\` if you really want to make space`
				}
			}
		} else if (!channel) {
			/* can't play if a voiceconnection isn't currently active and a channel to join isn't supplied */
			return {
				success: false,
				reason: "What'cha doin' asking for tunes? :face_with_raised_eyebrow: You're not even in a voice channel!"
			}
		} else {
			const permissions = channel.permissionsFor(this.client.user)
			if (!permissions || !permissions.has(Permissions.FLAGS.CONNECT) || !permissions.has(Permissions.FLAGS.SPEAK)) {
				return {
					success: false,
					reason: `I don't have the right permissions to join \`#${channel.name}\`! :scream: Let me in!!!`
				}
			}
		}

		return {
			success: true
		}
	}

	getState() {
		const player = this._getMusicPlayer()
		return player ? player.getState() : {
			looping: false,
			playing: undefined,
			queue: []
		}
	}

	toggleLoop() {
		const player = this._getMusicPlayer()
		if (player) {
			return player.toggleLoop()
		}
	}

	enqueue(list, index) {
		const player = this._getMusicPlayer()
		if (player) {
			return player.enqueue(list, index)
		}
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
		const player = this._getMusicPlayer()
		if (player) {
			player.clear()
		}
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
				//connection.on("stateChange", console.error)
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