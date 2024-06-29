const { MessageActionRow, MessageButton, Constants } = require('discord.js')

const BaseCommand = require('../BaseCommand')
const { EMPTY_UNICODE } = require('../CommandUtil')

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
            content: EMPTY_UNICODE,
            components: [
                new MessageActionRow()
                    .addComponents(
                        new MessageButton()
                            .setLabel("Invite Me!")
                            .setStyle(Constants.MessageButtonStyles.LINK)
                            .setURL(`https://discord.com/api/oauth2/authorize?client_id=${process.env.CLIENT_ID}&permissions=${process.env.PERMISSIONS_INT}&scope=bot%20applications.commands`)
                    )
            ],
            ephemeral: true
        })
    }
}