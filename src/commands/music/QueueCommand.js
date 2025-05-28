import unescape from 'unescape'
import { MessageEmbed } from 'discord.js'
import { BaseCommand } from '../BaseCommand.js'
import { formatSeconds, getEmbedPageMessage, getPageIndexFromButtonId, EMPTY_UNICODE } from '../CommandUtil.js'
import config from "../../../config.json" with { type: "json" }

const { PRIMARY_COLOR, INTERACT_LIFETIME, MAX_QUEUE_PAGE_SIZE } = config

/* return a description string based on the queue item and index */
function getQueueItemDescription(item, index) {

    return `${index ? `**\`${index}.\`** ` : ""}` /* queue position */
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
            embed.fields[embed.fields.length - 1].value += "\n" + EMPTY_UNICODE
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
                    value = EMPTY_UNICODE
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
        splitEmbed.fields[splitEmbed.fields.length - 1].value += "\n" + EMPTY_UNICODE
    }

    return splitEmbed
}

/* splits queue embed into an array of embeds, each one representing a page */
function paginateQueueEmbed(embed) {
    const result = []
    let current = spliceEmbedFields(embed, 2 + MAX_QUEUE_PAGE_SIZE)

    while (current && current !== embed) {
        result.push(current)
        current = spliceEmbedFields(embed, MAX_QUEUE_PAGE_SIZE)
    }

    result.push(embed)

    return result
}

export class QueueCommand extends BaseCommand {
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

    async run(action) {
        /* abort if nothing playing or in queue */
        const { playing, queue, looping } = action.manager.music.getState()
        if (!playing && queue.length === 0) {
            action.updateReply({ content: "I ain't performing or planning to yet! :anger: Maybe queue somethin' up first!", ephemeral: true })
            return
        }

        /* build queue embeds */

        const embed = new MessageEmbed()

        embed.setColor(PRIMARY_COLOR)
        embed.setTitle(`Performance Queue for ${action.manager.guild.name}`)

        if (playing) {
            embed.addField(EMPTY_UNICODE, `__Now ${looping ? "Looping :repeat_one:" : "Performing"}:__\n${getQueueItemDescription(playing)}`)
        }

        if (queue.length > 0) {
            if (playing) {
                embed.addField(EMPTY_UNICODE, `:arrow_down:__${looping ? "Queue" : "Up Next"}:__:arrow_down:`)
            }

            let totalSeconds = 0

            queue.forEach((item, index) => {
                totalSeconds += item.seconds
                embed.addField(EMPTY_UNICODE, getQueueItemDescription(item, index + 1))
            })

            embed.setFooter(`${queue.length} song${queue.length > 1 ? "s" : ""} in queue | ${formatSeconds(totalSeconds)} total in length`)
        }

        const pages = paginateQueueEmbed(embed)

        /* queue page state */

        let pageIndex = 0

        /* send queue and listen for button interactions */

        const collector = action.interaction.channel.createMessageComponentCollector({ 
            time: INTERACT_LIFETIME * 60 * 1000, 
            message: await action.updateReply({...getEmbedPageMessage(pageIndex, pages), fetchReply: true }) 
        })
        
        collector.on("end", () => action.setExpiredInteraction())
        collector.on("collect", i => {
            pageIndex = getPageIndexFromButtonId(i.customId, pageIndex, pages.length)
            i.update(getEmbedPageMessage(pageIndex, pages))
        })
    }
}