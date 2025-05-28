import unescape from 'unescape'
import { BaseCommand } from '../BaseCommand.js'
import { parseRanges } from '../CommandUtil.js'

export class MoveCommand extends BaseCommand {
    constructor(client) {
        super(client, {
            name: "move",
            description: "Move an item or range in the queue to a new index.",
            options: [
                {
                    name: "position",
                    type: "STRING",
                    description: "Queue position (ex: 9) or range (ex: 3-5)",
                    required: true
                },
                {
                    name: "new_position",
                    type: "NUMBER",
                    description: "New position",
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
        const { interaction, manager } = action

        const range = parseRanges(interaction.options.getString("position"))[0]
        if (!range) {
            action.updateReply({ content: `What'cha doin? :anger: Enter a valid range!'`, ephemeral: true })
            return
        }

        const removed = manager.music.remove([range])
        if (removed.length === 0) {
            action.updateReply({ content: `Go get your eyes checked! :anger: I ain't find nothin!'`, ephemeral: true })
            return
        }

        const { index } = manager.music.enqueue(removed, interaction.options.getNumber("new_position") - 1)

        action.updateReply(`:white_check_mark: **Moved** ${removed.length === 1 ? `\`${unescape(removed[0].snippet.title)}\`` : `\`${removed.length}\` performances`} to **\`#${index + 1}\`** in the queue!`)
    }
}