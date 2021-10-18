const BaseCommand = require('../BaseCommand')

module.exports = class InviteCommand extends BaseCommand {
    constructor(client) {
        super(client, {
            name: 'invite',
            group: 'util',
            memberName: 'invite',
            description: 'Replies with a link to invite the bot to servers.',
            throttling: {
                usages: 1,
                duration: 1
            }
        })
    }

    async run(interaction) {
        interaction.reply({
            content: `Use this link wisely. :link: With great power comes great responsibility...\n` 
                + `https://discord.com/api/oauth2/authorize?client_id=${process.env.CLIENT_ID}&permissions=${process.env.PERMISSIONS_INT}&scope=bot%20applications.commands`,
            ephemeral: true
        })
    }
}