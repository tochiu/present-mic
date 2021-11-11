const unescape = require('unescape')
const { MessageActionRow, MessageButton, MessageEmbed, Constants } = require('discord.js')

const { colorPrimary } = require('../../../config.json')

const PAGE_BUTTON_ID = {
    NEXT_PAGE: "next_page",
    PREV_PAGE: "prev_page",
    CURR_PAGE: "curr_page",
    FRST_PAGE: "frst_page",
    LAST_PAGE: "last_page",
}

const EMPTY_UNICODE = "\u200b"  /* some field values cannot be empty or whitespace => use an empty unicode character */

/* convert to seconds to mm:ss */
function formatSeconds(seconds) {
    return `${Math.floor(seconds / 60)}:${Math.round(seconds % 60).toString().padStart(2, "0")}`
}

/* parse 1-indexed comma delimited range strings */
function parseRanges(str) {
    return str
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
}

/* gets message from embed page index and list of embeds */
function getEmbedPageMessage(page, embeds) {
    if (embeds.length < 2) {
        return {
            embeds: [embeds[0]],
            components: []
        }
    }

    const buttons = [
        new MessageButton()
            .setCustomId(PAGE_BUTTON_ID.FRST_PAGE)
            .setEmoji("⏮️")
            .setStyle(Constants.MessageButtonStyles.PRIMARY)
            .setDisabled(page < 2),
        new MessageButton()
            .setCustomId(PAGE_BUTTON_ID.PREV_PAGE)
            .setEmoji("◀️")
            .setStyle(Constants.MessageButtonStyles.PRIMARY)
            .setDisabled(page === 0),
        new MessageButton()
            .setCustomId(PAGE_BUTTON_ID.CURR_PAGE)
            .setLabel(`Page ${page + 1}/${embeds.length}`)
            .setStyle(Constants.MessageButtonStyles.SECONDARY)
            .setDisabled(true),
        new MessageButton()
            .setCustomId(PAGE_BUTTON_ID.NEXT_PAGE)
            .setEmoji("▶️")
            .setStyle(Constants.MessageButtonStyles.PRIMARY)
            .setDisabled(page === embeds.length - 1),
        new MessageButton()
            .setCustomId(PAGE_BUTTON_ID.LAST_PAGE)
            .setEmoji("⏭️")
            .setStyle(Constants.MessageButtonStyles.PRIMARY)
            .setDisabled(page >= embeds.length - 2),
    ]

    return {
        embeds: [embeds[page]],
        components: embeds.length > 2 ? [new MessageActionRow().addComponents(...buttons)] : [new MessageActionRow().addComponents(...buttons.slice(1, 4))]
    }
}

function getPageIndexFromButtonId(id, pageIndex, pageCount) {
    switch (id) {
        case PAGE_BUTTON_ID.FRST_PAGE:
            pageIndex = 0
            break
        case PAGE_BUTTON_ID.PREV_PAGE:
            pageIndex = Math.max(pageIndex - 1, 0)
            break
        case PAGE_BUTTON_ID.NEXT_PAGE:
            pageIndex = Math.min(pageIndex + 1, pageCount - 1)
            break
        case PAGE_BUTTON_ID.LAST_PAGE:
            pageIndex = pageCount - 1
            break
    }

    return pageIndex
}

async function processSearch(action, query, isMultiSearch = false) {
    /* abort if query is nothing */
    query = query.trim()
    if (!query) {
        action.updateReply({ content: ":pinched_fingers: Gimme somethin' that makes sense kiddo!", ephemeral: true })
        return
    }
    
    /* abort if cant play */
    const { success, reason } = action.manager.music.canPlay(action.interaction.member.voice.channel)
    if (!success) {
        action.updateReply({ content: reason, ephemeral: true })
        return
    }

    /* defer */
    action.deferReply()

    /* search */
    try {
        const items = await action.manager.music.search(query, isMultiSearch)
        if (items.length === 0) {
            action.updateReply({ content: ":x: I got nothin'! :person_shrugging: Ain't find squat! :pinching_hand: You must be into weird stuff, huh?", ephemeral: true })
            return
        }

        return items
    } catch (e) {
        console.error("Search error")
        console.error(e)

        action.updateReply({ content: ":x: I couldn't search for what'cha askin' for... :grimacing: Sorry!", ephemeral: true })
    }
}

async function processPlay(action, items) {
    const result = await action.manager.music.play(
        items, 
        action.interaction.member.voice.channel, 
        action.interaction.member
    )

    if (result.success) {
        if (result.items.length === 1) { /* exactly one item was queued */
            const item = result.items[0]
            if (result.isPlayingNow) { /* that one item is current playing => print now playing message */
                action.updateReply({ content: `:arrow_forward: **Performing** :microphone: \`${unescape(item.snippet.title)}\` **now!**` })
            } else { /* that one item is not currently playing so it must be in queue => print item queue info */
                const embed = new MessageEmbed()
                embed.setColor(colorPrimary)
                embed.setAuthor("Performance Queued")
                embed.setThumbnail(item.snippet.thumbnails.default.url)
                embed.setDescription(`[**${unescape(item.snippet.title)}**](https://www.youtube.com/watch?v=${item.id})`)
                embed.addField("Channel", unescape(item.snippet.channelTitle), true)
                embed.addField("Duration", formatSeconds(item.seconds).toString(), true)
                embed.addField("Estimated Wait", formatSeconds(result.queueBeforeDuration + result.currentDurationLeft).toString(), true)
                embed.addField("Queue Position", (result.itemsStart + 1).toString())
                
                action.updateReply({ embeds: [embed] })
            }
        } else { /* multiple items were queued => print multi-item queue info */
            const embed = new MessageEmbed()
            embed.setColor(colorPrimary)
            embed.setAuthor("Performance Set Queued")
            embed.addField("Performances", `\`${result.items.length}\``, true)
            embed.addField("Duration", formatSeconds(result.itemsDuration).toString(), true)
            embed.addField("Estimated Wait", formatSeconds(result.queueBeforeDuration + result.currentDurationLeft).toString(), true)
            embed.addField("Queue Position", result.isPlayingNow ? "_Now Performing_" : (result.itemsStart + 1).toString())

            action.updateReply({ embeds: [embed] })
        }
    } else { /* the play operation failed to complete */
        action.updateReply({ content: result.reason })
    }
}

module.exports = {
    EMPTY_UNICODE,
    
    formatSeconds, 
    parseRanges, 
    getEmbedPageMessage, getPageIndexFromButtonId,
    processPlay, processSearch
}