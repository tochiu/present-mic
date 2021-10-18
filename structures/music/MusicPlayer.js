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

		this._voiceConnection.on('stateChange', async (_, newState) => {
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

		/*
			Listen for audioPlayer state changes
		*/
		this._audioPlayer.on('stateChange', (oldState, newState) => {
			/*
				Attempt to process queue if player is idle
			*/
			if (newState.status === AudioPlayerStatus.Idle && oldState.status !== AudioPlayerStatus.Idle) {
				console.log("Playback complete!")
				this.processQueue()
			}

			/*
				Destroy old resource metadata if it exists and is no longer in use
			*/
			// if (oldState.resource && oldState.resource !== newState.resource) {
			// 	this._destroyResourceMetadata(oldState.resource)
			// }
		})

		this._audioPlayer.on('error', e => {
			console.error("Playback error!")
			console.error(e)
			//this._destroyResourceMetadata(e.resource)
			this.processQueue()
		})

		voiceConnection.subscribe(this._audioPlayer)
	}

	getVoiceConnection() {
		return this._voiceConnection
	}

	getState() {
		const resource = this._audioPlayer.state.resource
		return {
			queue: [...this._queue],
			playing: resource && resource.metadata.track,
			playTimestamp: resource && resource.metadata.timestamp
		}
	}

	/**
	 * Skips
	 */
	skip() {
		this._audioPlayer.stop(true)
	}

	/**
	 * Adds tracks to the queue.
	 */
	enqueue(tracks) {
		this._queue.splice(this._queue.length, 0, ...tracks)
	}

	/**
	 * Removes tracks from the queue.
	 */
	remove(spliceList) {
		const removed = []
		for (const [index, amount] of spliceList) {
			removed.push(this._queue.splice(index, amount))
		}
		return [].concat(...removed)
	}

	/**
	 * Stops audio playback and empties the queue
	 */
	clear() {
		this._queue = []
		this._audioPlayer.stop(true)
	}

	/**
	 * Stops audio playback and empties the queue
	 */
	destroy() {
		console.log("Destroying player")
		this._queueLock = true
		this.clear()
	}

	/**
	 * Destroy old resource metadata
	 */
	// _destroyResourceMetadata(resource) {
	// 	const stream = resource.metadata.stream
	// 	if (!stream.destroyed) {
	// 		stream.destroy()
	// 	}
	// }
	
	/**
	 * Attempts to play a Track from the queue
	 */
	async processQueue() {
		// If the queue is locked (already being processed) or the audio player is already playing something, return
		if (this._queueLock || this._audioPlayer.state.status !== AudioPlayerStatus.Idle) {
			return true
		}

		// If the queue is empty return
		if (this._queue.length === 0) {
			return false
		}

		// Lock the queue to guarantee safe access
		this._queueLock = true

		// Take the first item from the queue. This is guaranteed to exist due to the non-empty check above.
		const track = this._queue.shift()

		try {

			console.log(`Playing "${track.snippet.title}" - link: https://www.youtube.com/watch?v=${track.id}`)

			// Attempt to convert the Track into an AudioResource (i.e. start streaming the video)
			//const stream = ytdl(`https://www.youtube.com/watch?v=${track.id}`, {filter: "audioonly", quality: "highestaudio", highWaterMark: 1 << 25})
			//const resource = createAudioResource(stream, { metadata: { stream, track, timestamp: Date.now() }})

			const stream = await playdl.stream(`https://www.youtube.com/watch?v=${track.id}`)
			const resource = createAudioResource(stream.stream, {
				inputType: stream.type,
				metadata: { 
					track, 
					timestamp: Date.now() 
				}
			})

			//playdl.attachListeners(this._audioPlayer, stream)
			
			this._audioPlayer.play(resource)
			this._queueLock = false
			return true
		} catch (e) {
			// If an error occurred, try the next item of the queue instead
			console.error(e)
			this._queueLock = false
			return await this.processQueue()
		}
	}
}

module.exports = MusicPlayer