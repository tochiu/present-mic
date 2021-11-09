const unescape = require('unescape')
const { MessageEmbed, MessageActionRow, MessageButton, Constants } = require('discord.js')

const BaseCommand = require('../BaseCommand')
const { formatSeconds } = require('../util')

const { colorPrimary, interactionLifetimeMinutes } = require('../../../config.json')

const PLACEHOLDER = "\u200b" /* field titles and values cannot be empty or whitespace => use an empty unicode character */

const BUTTON_ID = {
    NEXT_PAGE: "next_page",
    PREV_PAGE: "prev_page",
    CURR_PAGE: "curr_page",
    FRST_PAGE: "frst_page",
    LAST_PAGE: "last_page",
}

/* return a description string based on the queue item and index */
function getQueueItemDescription(item, index) {

    return `${index ? `\`${index}.\` ` : ""}` /* queue position */
        + `[${unescape(item.snippet.title)}](https://www.youtube.com/watch?v=${item.id})` /* item title and hyperlink */
        + ` | \`${formatSeconds(item.seconds)}` /* formatted time */
        + ` Requested by: ${item.requester.nickname || item.requester.user.tag}${item.requester.nickname ? ` (${item.requester.user.tag})` : ""}\`` /* requester */
}

/* 
    splices fields into a new embed until it reaches limitations or the given one is empty
    * if the given embed is already under limitations 
        * if the fields are empty then nothing is returned 
        * if the fields are non-empty then the given embed is returned 
*/
function spliceEmbedFields(embed, cutoff) {
    if (embed.length <= 6000 && embed.fields.length <= cutoff) {
        if (embed.fields.length === 0) {
            return
        }

        if (embed.footer) {
            embed.fields[embed.fields.length - 1].value += "\n" + PLACEHOLDER
        }

        return embed
    }

    const splitEmbed = new MessageEmbed()
    splitEmbed.setColor(embed.color)
    splitEmbed.setTitle(embed.title)
    if (embed.image) {
        splitEmbed.setImage(embed.image.url)
    }
    if (embed.footer) {
        splitEmbed.setFooter(embed.footer.text, embed.footer.iconURL)
    }
    
    while (splitEmbed.fields.length < cutoff && embed.fields.length > 0) {
        const field = embed.fields[0]
        let name = field.name
        let value = field.value

        const maxLen = 6000 - splitEmbed.length
        const len = name.length + value.length

        if (len > maxLen) {
            if (len > 6000) {
                if (name.length > 6000) {
                    name = name.substr(0, 6000 - 4) + "..."
                    value = PLACEHOLDER
                } else {
                    value = value.substr(0, 6000 - 4 - name.length) + "..."
                }

                embed.spliceFields(0, 1, { ...field, name, value })
            }

            break
        } else {
            splitEmbed.addFields(field)
            embed.spliceFields(0, 1)
        }
    }

    if (splitEmbed.footer) {
        splitEmbed.fields[splitEmbed.fields.length - 1].value += "\n" + PLACEHOLDER
    }

    return splitEmbed
}

/* splits queue embed into an array of embeds, each one representing a page */
function paginateQueueEmbed(embed) {
    const result = []
    let current = spliceEmbedFields(embed, 12)

    while (current && current !== embed) {
        result.push(current)
        current = spliceEmbedFields(embed, 10)
    }

    result.push(embed)

    return result
}

/* gets message from embed page index and list of embeds */
function getQueuePageMessage(page, embeds) {
    if (embeds.length < 2) {
        return {
            embeds: [embeds[0]],
            components: []
        }
    }

    const buttons = [
        new MessageButton()
            .setCustomId(BUTTON_ID.FRST_PAGE)
            .setLabel("First Page")
            .setStyle(Constants.MessageButtonStyles.PRIMARY)
            .setDisabled(page < 2),
        new MessageButton()
            .setCustomId(BUTTON_ID.PREV_PAGE)
            .setLabel("Prev Page")
            .setStyle(Constants.MessageButtonStyles.PRIMARY)
            .setDisabled(page === 0),
        new MessageButton()
            .setCustomId(BUTTON_ID.CURR_PAGE)
            .setLabel(`Page ${page + 1}`)
            .setStyle(Constants.MessageButtonStyles.SECONDARY)
            .setDisabled(true),
        new MessageButton()
            .setCustomId(BUTTON_ID.NEXT_PAGE)
            .setLabel("Next Page")
            .setStyle(Constants.MessageButtonStyles.PRIMARY)
            .setDisabled(page === embeds.length - 1),
        new MessageButton()
            .setCustomId(BUTTON_ID.LAST_PAGE)
            .setLabel("Last Page")
            .setStyle(Constants.MessageButtonStyles.PRIMARY)
            .setDisabled(page >= embeds.length - 2),
    ]

    return {
        embeds: [embeds[page]],
        components: embeds.length > 2 ? [new MessageActionRow().addComponents(...buttons)] : [new MessageActionRow().addComponents(...buttons.slice(1, 4))]
    }
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
        const { playing, queue, looping } = manager.music.getState()
        if (!playing && queue.length === 0) {
            interaction.reply({ content: "I ain't performing or planning to yet! :anger: Maybe queue somethin' up first!", ephemeral: true })
            return
        }

        /* build queue embeds */

        const embed = new MessageEmbed()

        embed.setColor(colorPrimary)
        embed.setTitle(`Performance Queue for ${manager.guild.name}`)

        if (playing) {
            embed.addField(PLACEHOLDER, `__Now ${looping ? "Looping :repeat_one:" : "Performing"}:__\n${getQueueItemDescription(playing)}`)
        }

        if (queue.length > 0) {
            if (playing) {
                embed.addField(PLACEHOLDER, `:arrow_down:__${looping ? "Queue" : "Up Next"}:__:arrow_down:`)
            }

            let totalSeconds = 0

            queue.forEach((item, index) => {
                totalSeconds += item.seconds
                embed.addField(PLACEHOLDER, getQueueItemDescription(item, index + 1))
            })

            embed.setFooter(`${queue.length} song${queue.length > 1 ? "s" : ""} in queue | ${formatSeconds(totalSeconds)} total in length`)
        }

        const pages = paginateQueueEmbed(embed)

        /* queue page state */

        let pageIndex = 0

        /* send queue and listen for button interactions */

        interaction.channel
            .createMessageComponentCollector({ 
                time: interactionLifetimeMinutes.queue * 60 * 1000, 
                message: await interaction.reply({...getQueuePageMessage(pageIndex, pages), fetchReply: true }) 
            })
            .on("collect", i => {
                const id = i.customId
                switch (id) {
                    case BUTTON_ID.FRST_PAGE:
                        pageIndex = 0
                        break
                    case BUTTON_ID.PREV_PAGE:
                        pageIndex = Math.max(pageIndex - 1, 0)
                        break
                    case BUTTON_ID.NEXT_PAGE:
                        pageIndex = Math.min(pageIndex + 1, pages.length - 1)
                        break
                    case BUTTON_ID.LAST_PAGE:
                        pageIndex = pages.length - 1
                        break
                    default:
                        return
                }
                
                i.update(getQueuePageMessage(pageIndex, pages))
            })
    }
}