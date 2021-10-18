const BaseCommand = require('../BaseCommand')

module.exports = class ClearCommand extends BaseCommand {
    constructor(client) {
        super(client, {
            name: 'clear',
            aliases: ['c'],
            group: 'music',
            memberName: 'clear',
            description: 'Clears the queue and skips any currently playing item',
            throttling: {
                usages: 1,
                duration: 1
            },
            guildOnly: true
        })
    }

    async run(interaction, manager) {
        let connectedChannelId = manager.guild.me && manager.guild.me.voice.channelId
        if (!connectedChannelId) {
            interaction.reply({ content: ":face_with_raised_eyebrow: I ain't in a voice channel...", ephemeral: true })
            return
        }

        if (connectedChannelId !== interaction.member.voice.channelId) {
            interaction.reply({ content: "You ain't even listenin' to me! :anger: Why would I listen to ya?!", ephemeral: true })
            return
        }

        const state = manager.music.getState()

        if (state.playing || state.queue.length > 0) {
            manager.music.clear()
            interaction.reply(`:microphone2: Don't really like cuttin' the cord but you're the boss!`)
        } else {
            interaction.reply({ content: ":face_with_raised_eyebrow: There's nothin' to clear friend...", ephemeral: true })
        }
    }
}