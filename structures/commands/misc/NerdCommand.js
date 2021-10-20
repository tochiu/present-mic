
const { generateDependencyReport } = require('@discordjs/voice')

const BaseCommand = require('../BaseCommand')

module.exports = class NerdCommand extends BaseCommand {
    constructor(client) {
        super(client, {
            name: "nerd",
            description: "Generate a voice debug report for nerds.",
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