import unescape from 'unescape'
import { BaseCommand } from '../BaseCommand.js'
import { parseRanges } from '../CommandUtil.js'

export class RemoveCommand extends BaseCommand {
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

    async run(action) {
        const removed = action.manager.music.remove(
            parseRanges(action.interaction.options.getString("positions"))
                .sort((a, b) => b[0] - a[0])
        )

        if (removed.length === 0) {
            action.updateReply({ content: `Go get your eyes checked! :anger: I ain't find nothin!'`, ephemeral: true })
        } else {
            action.updateReply({
                content: removed.length === 1 
                    ? `:white_check_mark: **Cut** \`${unescape(removed[0].snippet.title)}\` from performances!` 
                    : `:white_check_mark: **Cut** \`${removed.length}\` performances!`
            })
        }
    }
}