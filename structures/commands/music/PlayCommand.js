const BaseCommand = require('../BaseCommand')
const { processPlay, processSearch } = require('../util')

module.exports = class PlayCommand extends BaseCommand {
    constructor(client) {
        super(client, {
            name: "play",
            description: "Search and queue up an item. Direct YouTube video and playlist links are supported.",
            options: [
                {
                    name: "query",
                    type: "STRING",
                    description: "YouTube search query",
                    required: true
                }
            ],
            throttling: {
                usages: 60,
                duration: 60
            }
        })
    }

    async run(action) {
        const items = await processSearch(action, action.interaction.options.getString("query"))
        if (!items) {
            return
        }

        await processPlay(action, items)
    }
}