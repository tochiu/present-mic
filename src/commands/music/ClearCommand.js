const BaseCommand = require('../BaseCommand')

module.exports = class ClearCommand extends BaseCommand {
    constructor(client) {
        super(client, {
            name: "clear",
            description: "Clear the queue and skip any playing item.",
            throttling: {
                usages: 1,
                duration: 1
            }
        })
    }

    async run(action) {
        const { manager, interaction } = action

        /* abort if not in channel */
        let connectedChannelId = manager.guild.me && manager.guild.me.voice.channelId
        if (!connectedChannelId) {
            action.updateReply({ content: ":face_with_raised_eyebrow: I ain't in a voice channel...", ephemeral: true })
            return
        }

        /* abort if interactor is not in the same channel */
        if (connectedChannelId !== interaction.member.voice.channelId) {
            action.updateReply({ content: "You ain't even listenin' to me! :anger: Why would I listen to ya?!", ephemeral: true })
            return
        }

        const state = manager.music.getState()

        /* abort if theres's nothing to clear */
        if (!state.playing && state.queue.length === 0) {
            action.updateReply({ content: ":face_with_raised_eyebrow: There's nothin' to clear...", ephemeral: true })
            return
        }

        /* skip */
        manager.music.clear()
        action.updateReply(`:microphone2: Don't really like cuttin' the cord but ya the boss!`)
    }
}