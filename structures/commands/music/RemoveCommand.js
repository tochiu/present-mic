const unescape = require('unescape')

const BaseCommand = require('../BaseCommand')
const { parseRanges } = require('../util')

module.exports = class RemoveCommand extends BaseCommand {
    constructor(client) {
        super(client, {
            name: "remove",
            description: "Remove items in the queue. Comma-separated indexes or index ranges are supported.",
            options: [
                {
                    name: "positions",
                    type: "STRING",
                    description: "Queue positions (ex: 4, 8-12, 16, 20-24)",
                    required: true
                }
            ],
            throttling: {
                usages: 2,
                duration: 1
            }
        })
    }

    async run(interaction, manager) {

        const removed = manager.music.remove(
            parseRanges(interaction.options.getString("positions"))
                .sort((a, b) => b[0] - a[0]) /* sort ranges in descending order of the starting index to preserve indexes after each remove operation */
        )

        if (removed.length === 0) {
            interaction.reply({ content: `Go get your eyes checked! :anger: I ain't find nothin!'`, ephemeral: true })
        } else if (removed.length === 1) {
            interaction.reply(`:white_check_mark: **Cut** \`${unescape(removed[0].snippet.title)}\` from performances!`)
        } else {
            interaction.reply(`:white_check_mark: **Cut** \`${removed.length}\` performances!`)
        }
    }
}