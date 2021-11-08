const unescape = require('unescape')

const BaseCommand = require('../BaseCommand')
const { parseRanges } = require('../util')

module.exports = class RemoveCommand extends BaseCommand {
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

    async run(interaction, manager) {
        /* abort if a range couldn't be parsed */
        const range = parseRanges(interaction.options.getString("position"))[0]
        if (!range) {
            interaction.reply({ content: `What'cha doin? :anger: Enter a valid range!'`, ephemeral: true })
            return
        }

        /* abort if nothing was removed */
        const removed = manager.music.remove([range])
        if (removed.length === 0) {
            interaction.reply({ content: `Go get your eyes checked! :anger: I ain't find nothin!'`, ephemeral: true })
            return
        }

        /* we don't need to check if enqueue succeeded because the above check guarantees that a player is active => enqeue always succeeds */
        const { index } = manager.music.enqueue(removed, interaction.options.getNumber("new_position") - 1)

        /* send success message */
        interaction.reply(`:white_check_mark: **Moved** ${removed.length === 1 ? `\`${unescape(removed[0].snippet.title)}\`` : `\`${removed.length}\` performances`} to **\`#${index + 1}\`** in the queue!`)
    }
}