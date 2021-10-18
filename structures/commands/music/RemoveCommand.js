const unescape = require("unescape")

const BaseCommand = require('../BaseCommand')

module.exports = class RemoveCommand extends BaseCommand {
    constructor(client) {
        super(client, {
            name: 'remove',
            aliases: ['r'],
            group: 'music',
            memberName: 'remove',
            description: 'Removes an item in the queue. Comma-separated indexes or index ranges are supported.',
            throttling: {
                usages: 2,
                duration: 1
            },
            guildOnly: true
        })
    }

    buildSlashCommand(slashCommandBuilder) {
        slashCommandBuilder.addStringOption(option => option.setName("positions").setDescription("Queue positions").setRequired(true))
    }
    
    async run(interaction, manager) {
        const removed = manager.music.remove(
            interaction.options
                .getString("positions")
                .trim()
                .split(",")
                .map(rangeStr => rangeStr
                    .split("-")
                    .map(num => parseInt(num))
                    .filter(num => !isNaN(num) && num > 0)
                )
                .map(range => {
                    const a = range[0]
                    const b = range[range.length - 1]

                    if (a && b) {
                        return [Math.min(a, b) - 1, Math.max(a, b) - (Math.min(a, b) - 1)]
                    }
                })
                .filter(splice => splice)
                .sort((a, b) => b[0] - a[0])
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