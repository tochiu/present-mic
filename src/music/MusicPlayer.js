import { promisify } from 'util'
import {
  AudioPlayerStatus,
  createAudioPlayer,
  createAudioResource,
  entersState,
  VoiceConnectionDisconnectReason,
  VoiceConnectionStatus,
} from '@discordjs/voice'
import { EnabledTrackTypes } from 'googlevideo/utils'
import { createSabrStream } from './utils/sabr-stream-factory.js'

const wait = promisify(setTimeout)


/**
 * A MusicPlayer exists for each active VoiceConnection. Each subscription has its own audio player and queue,
 * and it also attaches logic to the audio player and voice connection for error handling and reconnection logic.
 */

export class MusicPlayer {

	constructor(voiceConnection) {
		this._voiceConnection = voiceConnection
		this._audioPlayer = createAudioPlayer()
		this._queue = []
		this._queueLock = false
		this._readyLock = false
		this._looping = false

		this._voiceConnection.on("stateChange", async (_, newState) => {
			if (newState.status === VoiceConnectionStatus.Disconnected) {
				if (newState.reason === VoiceConnectionDisconnectReason.WebSocketClose && newState.closeCode === 4014) {
					/*
						If the WebSocket closed with a 4014 code, this means that we should not manually attempt to reconnect,
						but there is a chance the connection will recover itself if the reason of the disconnect was due to
						switching voice channels. This is also the same code for the bot being kicked from the voice channel,
						so we allow 20 seconds to figure out which scenario it is. If the bot has been kicked, we should destroy
						the voice connection.
					*/
					try {
						/* Probably moved voice channel */
						await entersState(this._voiceConnection, VoiceConnectionStatus.Connecting, 20000)
					} catch {
						console.log("Destroying voice connection due to timeout in awaiting reconnection from websocket close with code 4014 (should not manually reconnect)")
						/* Probably removed from voice channel */
						this._voiceConnection.destroy()
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
					console.log("Destroying voice connection due to exceeding rejoin attempts")
					console.log(`Disconnect reason: ${newState.reason}, Close code: ${newState.closeCode}`)
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
				} catch (e) {
					console.error("Failure to enter ready state")
					console.error(e)
					if (this._voiceConnection.state.status !== VoiceConnectionStatus.Destroyed) {
						console.log("Destroying voice connection due to timeout in awaiting ready state")
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

				/* this is guaranteed to exist because states outside of idle have a resource */
				const metadata = oldState.resource.metadata

				this.processNext(this._looping && metadata.loopable && metadata.track)
			}
		})
		
		this._audioPlayer.on("error", e => {
			console.error("Playback error!")
			console.error(e)
			this.processNext()
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
			looping: this._looping,
			queue: [...this._queue],
			playing: resource && resource.metadata.track,
			playTimestamp: resource && resource.metadata.timestamp
		}
	}

	toggleLoop() {
		this._looping = !this._looping
		return this._looping
	}

	skip() {
		const resource = this._audioPlayer.state.resource
		if (resource) {
			resource.metadata.loopable = false
			this._audioPlayer.stop(true)
		}
	}

	enqueue(tracks, index) {
		index = index === undefined ? this._queue.length : Math.max(0, Math.min(this._queue.length, index))
		this._queue.splice(index, 0, ...tracks)

		/* return insert index */
		return { index, processing: this.processNext() }
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
		this.skip()
	}

	destroy() {
		console.log("Destroying player")
		this._queueLock = true
		this.clear()
	}

	async processNext(track) {
		/* If the queue is locked (already being processed) or the audio player is already playing something, return */
		if (this._queueLock || this._audioPlayer.state.status !== AudioPlayerStatus.Idle) {
			/* return true because we don't need to process the queue right now, which counts as a success */
			return true
		}

		/* Use the specified track or take the first item from the queue. */
		track = track || this._queue.shift()
		
		/* If a track to play doesn't exist return */
		if (!track) {
			/* If looping is on then we should disable it */
			if (this._looping) {
				this._looping = false
			}

			return false
		}

		/* Lock the queue to guarantee safe access */
		this._queueLock = true

		try {

			console.log(`Playing "${track.snippet.title}" - link: https://www.youtube.com/watch?v=${track.id}`)

			/* Attempt to convert the Track into an AudioResource */
			const stream = (await createSabrStream(track.id, {
				preferOpus: true,
				audioQuality: 'AUDIO_QUALITY_MEDIUM',
				enabledTrackTypes: EnabledTrackTypes.AUDIO_ONLY
			})).streamResults.audioStream
			const resource = createAudioResource(stream, {
				inputType: stream.type,
				metadata: {
					track,
					loopable: true,
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
			return await this.processNext()
		}
	}
}