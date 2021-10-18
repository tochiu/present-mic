
const { generateDependencyReport } = require('@discordjs/voice')

const BaseCommand = require('../BaseCommand')

module.exports = class NerdCommand extends BaseCommand {
    constructor(client) {
        super(client, {
            name: 'nerd',
            group: 'misc',
            memberName: 'nerd',
            description: 'Debug data for nerds',
            throttling: {
                usages: 1,
                duration: 1
            }
        })
    }

    async run(interaction) {
        interaction.reply({
            content: generateDependencyReport(),
            ephemeral: true
        })
    }
}