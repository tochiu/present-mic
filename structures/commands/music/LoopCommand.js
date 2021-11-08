const BaseCommand = require('../BaseCommand')

module.exports = class LoopCommand extends BaseCommand {
    constructor(client) {
        super(client, {
            name: "loop",
            description: "Enable or disable looping",
            throttling: {
                usages: 2,
                duration: 1
            }
        })
    }

    async run(interaction, manager) {
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

        /* toggle loop */
        const looping = manager.music.toggleLoop()

        /* feedback */
        interaction.reply(`${looping ? ":white_check_mark:" : ":x:"} Looping has been **${looping ? "Enabled" : "Disabled" }**!`)
    }
}