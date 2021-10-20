const BaseCommand = require('../BaseCommand')

module.exports = class InviteCommand extends BaseCommand {
    constructor(client) {
        super(client, {
            name: "invite",
            description: "Provide a link to invite the bot to a server.",
            throttling: {
                usages: 1,
                duration: 1
            }
        })
    }

    async run(interaction) {
        interaction.reply({
            content: `Use this link wisely. :link: With great power comes great responsibility.\nhttps://discord.com/api/oauth2/authorize?client_id=${process.env.CLIENT_ID}&permissions=${process.env.PERMISSIONS_INT}&scope=bot%20applications.commands`,
            ephemeral: true
        })
    }
}