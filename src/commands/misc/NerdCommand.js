const BaseCommand = require('../BaseCommand')

module.exports = class NerdCommand extends BaseCommand {

    constructor(client) {
        super(client, {
            name: "nerd",
            description: "Output version and generate a voice debug report for nerds.",
            throttling: {
                usages: 1,
                duration: 1
            }
        })
    }

    async run(action) {
        action.updateReply({ content: process.env.PRESENT_MIC_DEBUG_INFO, ephemeral: true })
    }
}