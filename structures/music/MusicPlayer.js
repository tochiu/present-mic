const { promisify } = require('util')
const playdl = require('play-dl')
const {
	AudioPlayerStatus,
	createAudioPlayer,
	createAudioResource,
	entersState,
	VoiceConnectionDisconnectReason,
	VoiceConnectionStatus,
} = require('@discordjs/voice')

const wait = promisify(setTimeout)

/**
 * A MusicPlayer exists for each active VoiceConnection. Each subscription has its own audio player and queue,
 * and it also attaches logic to the audio player and voice connection for error handling and reconnection logic.
 */
class MusicPlayer {

	constructor(voiceConnection) {
		this._voiceConnection = voiceConnection
		this._audioPlayer = createAudioPlayer()
		this._queue = []
		this._queueLock = false
		this._readyLock = false

		this._voiceConnection.on("stateChange", async (_, newState) => {
			if (newState.status === VoiceConnectionStatus.Disconnected) {
				if (newState.reason === VoiceConnectionDisconnectReason.WebSocketClose && newState.closeCode === 4014) {
					/*
						If the WebSocket closed with a 4014 code, this means that we should not manually attempt to reconnect,
						but there is a chance the connection will recover itself if the reason of the disconnect was due to
						switching voice channels. This is also the same code for the bot being kicked from the voice channel,
						so we allow 5 seconds to figure out which scenario it is. If the bot has been kicked, we should destroy
						the voice connection.
					*/
					try {
						await entersState(this._voiceConnection, VoiceConnectionStatus.Connecting, 5000)
						// Probably moved voice channel
					} catch {
						this._voiceConnection.destroy()
						// Probably removed from voice channel
					}
				} else if (this._voiceConnection.rejoinAttempts < 5) {
					/*
						The disconnect in this case is recoverable, and we also have <5 repeated attempts so we will reconnect.
					*/
					await wait((this._voiceConnection.rejoinAttempts + 1) * 5000)
					this._voiceConnection.rejoin()
				} else {
					/*
						The disconnect in this case may be recoverable, but we have no more remaining attempts - destroy.
					*/
					this._voiceConnection.destroy()
				}
			} else if (newState.status === VoiceConnectionStatus.Destroyed) {
				/*
					Once destroyed, stop the subscription
				*/
				this.destroy()
			} else if (
				!this._readyLock &&
				(newState.status === VoiceConnectionStatus.Connecting || newState.status === VoiceConnectionStatus.Signalling)
			) {
				/*
					In the Signalling or Connecting states, we set a 20 second time limit for the connection to become ready
					before destroying the voice connection. This stops the voice connection permanently existing in one of these
					states.
				*/
				this._readyLock = true
				try {
					await entersState(this._voiceConnection, VoiceConnectionStatus.Ready, 20000)
				} catch {
					if (this._voiceConnection.state.status !== VoiceConnectionStatus.Destroyed) {
						this._voiceConnection.destroy()
					}
				} finally {
					this._readyLock = false
				}
			}
		})

		/* Listen for audioPlayer state changes */
		this._audioPlayer.on("stateChange", (oldState, newState) => {
			/* Attempt to process queue if player is idle */
			if (newState.status === AudioPlayerStatus.Idle && oldState.status !== AudioPlayerStatus.Idle) {
				console.log("Playback complete!")
				this.processQueue()
			}
		})

		this._audioPlayer.on("error", e => {
			console.error("Playback error!")
			console.error(e)
			this.processQueue()
		})

		voiceConnection.subscribe(this._audioPlayer)
	}

	getVoiceConnection() {
		/* return voice connection */
		return this._voiceConnection
	}

	getState() {
		const resource = this._audioPlayer.state.resource

		/* return state */
		return {
			queue: [...this._queue],
			playing: resource && resource.metadata.track,
			playTimestamp: resource && resource.metadata.timestamp
		}
	}

	skip() {
		this._audioPlayer.stop(true)
	}

	enqueue(tracks, index) {
		index = index === undefined ? this._queue.length : Math.max(0, Math.min(this._queue.length, index))
		this._queue.splice(index, 0, ...tracks)

		/* return insert index */
		return index
	}

	remove(spliceList) {
		const removed = []
		for (const [index, amount] of spliceList) {
			removed.push(this._queue.splice(index, amount))
		}

		/* return removed tracks */
		return [].concat(...removed)
	}

	clear() {
		this._queue = []
		this._audioPlayer.stop(true)
	}

	destroy() {
		console.log("Destroying player")
		this._queueLock = true
		this.clear()
	}

	async processQueue() {
		/* If the queue is locked (already being processed) or the audio player is already playing something, return */
		if (this._queueLock || this._audioPlayer.state.status !== AudioPlayerStatus.Idle) {
			/* return true because we don't need to process the queue right now, which counts as a success */
			return true
		}

		/* If the queue is empty return */
		if (this._queue.length === 0) {
			return false
		}

		/* Lock the queue to guarantee safe access */
		this._queueLock = true

		/* Take the first item from the queue. This is guaranteed to exist due to the non-empty check above. */
		const track = this._queue.shift()

		try {

			console.log(`Playing "${track.snippet.title}" - link: https://www.youtube.com/watch?v=${track.id}`)

			/* Attempt to convert the Track into an AudioResource */

			const stream = await playdl.stream(`https://www.youtube.com/watch?v=${track.id}`)
			const resource = createAudioResource(stream.stream, {
				inputType: stream.type,
				metadata: {
					track,
					timestamp: Date.now()
				}
			})

			/* Stream the AudioResource and unlock the queue */

			this._audioPlayer.play(resource)
			this._queueLock = false
			return true

		} catch (e) {

			/* If an error occurred, unlock the queue try the next item of the queue instead */

			console.error(e)
			this._queueLock = false
			return await this.processQueue()
		}
	}
}

module.exports = MusicPlayer