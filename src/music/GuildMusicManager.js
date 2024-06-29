const { Permissions } = require('discord.js')
const { joinVoiceChannel, getVoiceConnection } = require('@discordjs/voice')

const MusicSearcher = require("./MusicSearcher")
const MusicPlayer = require("./MusicPlayer")

const { MAX_QUEUE_ITEMS } = require("../../config.json")

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

	async search(query, isMultiSearch) {
		console.log(`Searching: ${query}`)
		return this._searcher.search(query, isMultiSearch)
	}

	async play(items, channel, requester) {

		/* check if we can play tracks */
		const result = this.canPlay(channel)
		if (!result.success) {
			return result
		}

		const player = this._getMusicPlayer(channel)
		const maxItems = MAX_QUEUE_ITEMS - player.getState().queue.length

		/* copy items and cut items over the maxQueueItem limit */
		items = items.slice(0, maxItems)

		const state = player.getState()
		const playingBefore = state.playing
		const queueBefore = state.queue
		const playingBeforeTimestamp = state.playTimestamp

		/* attach additional data to each item */
		for (const item of items) {

			console.log(`Queueing "${item.snippet.title}" - link: https://www.youtube.com/watch?v=${item.id}`)

			item.requester = requester
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
	}

	canPlay(channel) {
		const player = this._getMusicPlayer()
		if (player) {
			/* can't play if the queue is full */
			if (player.getState().queue.length >= MAX_QUEUE_ITEMS) {
				return {
					success: false,
					reason: `The queue already contains \`${MAX_QUEUE_ITEMS}\` performances! :fearful:  Use \`/remove\` or \`/clear\` if you really want to make space`
				}
			}
		} else if (!channel) {
			/* can't play if a voiceconnection isn't currently active and a channel to join isn't supplied */
			return {
				success: false,
				reason: "What'cha doin' asking for tunes? :face_with_raised_eyebrow: You're not even in a voice channel!"
			}
		} else {
			/* can't play if you cannot join the requested voice channel */
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

	async handleVoiceStateUpdate(oldState, _) {
		const connection = getVoiceConnection(this.guild.id)
		if (!connection) {
			return
		}

		const { channel } = oldState

		if (
			channel &&
			channel.id &&
			channel.id === connection.joinConfig.channelId &&
			channel.members.size === 1 &&
			channel.members.has(this.guild.client?.user.id)
		) {
			console.log("connection destroyed")
			connection.destroy()
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

				// WORKAROUND FOR ISSUE: https://github.com/discordjs/discord.js/issues/9185#issuecomment-1452514375

				const networkStateChangeHandler = (_, newNetworkState) => {
					const newUdp = Reflect.get(newNetworkState, 'udp');
					clearInterval(newUdp?.keepAliveInterval);
				};
				connection.on('stateChange', (oldState, newState) => {
					Reflect.get(oldState, 'networking')?.off('stateChange', networkStateChangeHandler);
					Reflect.get(newState, 'networking')?.on('stateChange', networkStateChangeHandler);
				});
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