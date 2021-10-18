const BaseCommand = require('../BaseCommand')

module.exports = class PlayCommand extends BaseCommand {
    constructor(client) {
        super(client, {
            name: 'skip',
            aliases: ['s', 'fs'],
            group: 'music',
            memberName: 'skip',
            description: 'Skips what is currently playing',
            throttling: {
                usages: 2,
                duration: 1
            },
            guildOnly: true
        })
    }

    run(interaction, manager) {
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
        if (state.playing) {
            manager.music.skip()
            interaction.reply(`Skipping current performance${ state.queue.length > 0 ? ` :microphone: Next up is \`${state.queue[0].snippet.title}\`` : "..." }`)
        } else {
            interaction.reply({ content: ":face_with_raised_eyebrow: There's nothin' to skip friend...", ephemeral: true })
        }
    }
}