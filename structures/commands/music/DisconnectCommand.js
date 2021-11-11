const { getVoiceConnection } = require('@discordjs/voice')

const BaseCommand = require('../BaseCommand')

module.exports = class DisconnectCommand extends BaseCommand {
    constructor(client) {
        super(client, {
            name: "disconnect",
            description: "Disconnect the bot from the voice channel.",
            throttling: {
                usages: 1,
                duration: 1
            }
        })
    }

    async run(action) {
        const connection = getVoiceConnection(action.manager.guild.id)
        if (connection) {
            connection.destroy()
            action.updateReply(":wave: Goodbye...")
        } else {
            action.updateReply({ content: ":face_with_raised_eyebrow: I ain't in a voice channel...", ephemeral: true })
        }
    }
}