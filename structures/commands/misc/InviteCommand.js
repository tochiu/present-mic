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

    async run(action) {
        action.updateReply({
            content: `:link: Share the love! :link: \nhttps://discord.com/api/oauth2/authorize?client_id=${process.env.CLIENT_ID}&permissions=${process.env.PERMISSIONS_INT}&scope=bot%20applications.commands`,
            ephemeral: true
        })
    }
}