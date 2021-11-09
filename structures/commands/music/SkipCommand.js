const BaseCommand = require('../BaseCommand')

module.exports = class PlayCommand extends BaseCommand {
    constructor(client) {
        super(client, {
            name: "skip",
            description: "Skip what is playing.",
            throttling: {
                usages: 2,
                duration: 1
            }
        })
    }

    run(interaction, manager) {
        /* abort if not in channel */
        let connectedChannelId = manager.guild.me && manager.guild.me.voice.channelId
        if (!connectedChannelId) {
            interaction.reply({ content: ":face_with_raised_eyebrow: I ain't in a voice channel...", ephemeral: true })
            return
        }

        /* abort if interactor is not in the same channel */
        if (connectedChannelId !== interaction.member.voice.channelId) {
            interaction.reply({ content: "You ain't even listenin' to me! :anger: Why would I listen to ya?!", ephemeral: true })
            return
        }

        /* attempt skip */
        const { playing, queue } = manager.music.getState()
        if (playing) {
            manager.music.skip()
            interaction.reply(`:track_next: **Skipping** \`${playing.snippet.title}\`${queue.length > 0 ? ` :microphone: **Next up is** \`${queue[0].snippet.title}\`` : ""}`)
        } else {
            interaction.reply({ content: ":face_with_raised_eyebrow: There's nothin' to skip friend...", ephemeral: true })
        }
    }
}