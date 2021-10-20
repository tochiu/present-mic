const unescape = require('unescape')
const { MessageEmbed } = require('discord.js')

const BaseCommand = require('../BaseCommand')
const { formatSeconds } = require('../util')

const { colorPrimary } = require('../../../config.json')

const placeholder = "⠀" /* field titles and values cannot be empty or whitespace => use an empty unicode character */

/* return a description string based on the queue item and index */
function getQueueItemDescription(item, index) {
    
    return `${index ? `\`${index}.\` ` : ""}` /* queue position */
        + `[${unescape(item.snippet.title)}](https://www.youtube.com/watch?v=${item.id})` /* item title and hyperlink */
        + ` | \`${formatSeconds(item.seconds)}` /* formatted time */
        + ` Requested by: ${item.requester.nickname || item.requester.user.tag}${item.requester.nickname ? ` (${item.requester.user.tag})` : ""}\`` /* requester */
}

/* cuts the given embeds fields into a new embed until either that new embed is reaches embed limits or the given one is under limits */
/* returns the new embed or the given one if its already under embed limits */
function spliceEmbedFields(embed) {
    const splitEmbed = new MessageEmbed()

    while (splitEmbed.fields.length < 25 && (embed.length > 6000 || embed.fields.length > 25) && embed.fields.length > 0) {
        const field = embed.fields[embed.fields.length - 1]
        let name = field.name
        let value = field.value

        const maxLen = 6000 - splitEmbed.length
        const len = name.length + value.length

        if (len > maxLen) {
            if (len > 6000) {
                if (name.length > 6000 ) {
                    name = name.substr(0, 6000 - 4) + "..."
                    value = placeholder
                } else {
                    value = value.substr(0, 6000 - 3 - name.length) + "..."
                }

                embed.spliceFields(embed.fields.lenth - 1, 1, { ...field, name, value })
            }

            break
        } else {
            splitEmbed.spliceFields(0, 0, field)
            embed.spliceFields(embed.fields.length - 1, 1)
        }
    }

    return splitEmbed.fields.length === 0 ? embed : splitEmbed
}

/* splices an embed into an array of an array of embeds result[index] = embed array to send as a single message, result[index][index] = single embed */
function getSplicedQueueEmbeds(embed) {
    const results = []

    let group = []
    let groupLength = 0

    results.unshift(group)

    let current

    while (current !== embed) {
        current = spliceEmbedFields(embed)
        if (group.length === 10 || groupLength + current.length > 6000) {
            group = []
            groupLength = 0
            results.unshift(group)
        }

        current.setColor(embed.color)
        group.unshift(current)
        groupLength += current.length
    }

    if (groupLength === 0) {
        results.shift()
    }

    return results
}

module.exports = class QueueCommand extends BaseCommand {
    constructor(client) {
        super(client, {
            name: "queue",
            description: "Display the queue.",
            throttling: {
                usages: 1,
                duration: 2
            }
        })
    }
    
    async run(interaction, manager) {
        /* abort if nothing playing or in queue */
        const { playing, queue } = manager.music.getState()
        if (!playing && queue.length === 0) {
            interaction.reply({ content: "I ain't performing or planning to yet! :angry: Maybe queue somethin' up first!", ephemeral: true })
            return
        }

        /* build queue message */

        const embed = new MessageEmbed()

        embed.setColor(colorPrimary)
        embed.setTitle(`Performance Queue for ${manager.guild.name}`)

        if (playing) {
            embed.addField(placeholder, `__Now Performing:__\n${getQueueItemDescription(playing)}`)

            if (queue.length > 0) {
                embed.addField(placeholder, ":arrow_down:__Up Next:__:arrow_down:\n")
            }
        }

        if (queue.length > 0) {

            let totalSeconds = 0

            queue.forEach((item, index) => {
                totalSeconds += item.seconds
                embed.addField(placeholder, getQueueItemDescription(item, index + 1))
            })

            embed.addField(`${placeholder}\n${queue.length} songs in queue | ${formatSeconds(totalSeconds)} total in length`, placeholder)
        }

        /* send queue messages */

        let message
        for (const embeds of getSplicedQueueEmbeds(embed)) {
            if (message) {
                message = await message.reply({ embeds })
            } else {
                message = await interaction.reply({ embeds, fetchReply: true })
            }
        }
    }
}