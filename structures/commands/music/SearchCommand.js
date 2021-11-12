const unescape = require('unescape')
const { MessageEmbed, MessageActionRow, MessageButton, MessageSelectMenu, Constants } = require('discord.js')

const BaseCommand = require('../BaseCommand')
const { formatSeconds, getEmbedPageMessage, getPageIndexFromButtonId, processPlay, processSearch } = require('../CommandUtil')

const { PRIMARY_COLOR, INTERACT_LIFETIME, MAX_SEARCH_PAGE_SIZE } = require('../../../config.json')

const RESULT_SELECT_MENU_ID = "result_select_menu"
const SELECT_SEARCH_BUTTON_ID = "search_again_button"

function paginateSearchResults(results) {
    const pages = []
    const pageResults = []
    for (let i = 0; i < results.length; i += MAX_SEARCH_PAGE_SIZE) {
        const pageEmbeds = []
        const pageResultSlice = []
        
        pageEmbeds.push(
            new MessageEmbed()
                .setColor(PRIMARY_COLOR)
                .setTitle(":mag_right: Search Results")
        )

        results.slice(i, Math.min(results.length, i + MAX_SEARCH_PAGE_SIZE)).forEach((item, sliceIndex) => {
            const id = item.id
            const title = unescape(item.snippet.title)

            pageResultSlice.push({ id, title })
            pageEmbeds.push(
                new MessageEmbed()
                    .setColor(PRIMARY_COLOR)
                    .setThumbnail(item.snippet.thumbnails.default.url)
                    .setDescription(`**\`${i + sliceIndex + 1}.\`** [**${title}**](https://www.youtube.com/watch?v=${id})`)
                    .addField("Channel", unescape(item.snippet.channelTitle), true)
                    .addField("Duration", formatSeconds(item.seconds), true)
            )
        })

        pages.push(pageEmbeds)
        pageResults.push(pageResultSlice)
    }

    return { pages, pageResults }
}

function getSearchPageMessage(page, embeds, pageResults) {
    const message = getEmbedPageMessage(page, embeds)
    message.embeds = message.embeds[0] || []
    message.components.push(
        new MessageActionRow()
            .addComponents(
                new MessageSelectMenu()
                    .setCustomId(RESULT_SELECT_MENU_ID)
                    .setPlaceholder("Please Select a Search Result")
                    .addOptions(
                        pageResults[page].map((result, i) => {
                            const resultIndex = MAX_SEARCH_PAGE_SIZE*page + i
                            return {
                                label: `#${resultIndex + 1}`,
                                description: result.title,
                                value: resultIndex.toString()
                            }
                        })
                    )
            )
    )

    return message
}

function appendSelectSearch(message) {
    message.components.push(
        new MessageActionRow().addComponents(
            new MessageButton()
                .setCustomId(SELECT_SEARCH_BUTTON_ID)
                .setEmoji("🔎")
                .setLabel("Select More")
                .setStyle(Constants.MessageButtonStyles.PRIMARY)
        )
    )

    return message
}

module.exports = class SearchCommand extends BaseCommand {
    constructor(client) {
        super(client, {
            name: "search",
            description: "Pick from a list of results from the query to play",
            options: [
                {
                    name: "query",
                    type: "STRING",
                    description: "YouTube search query",
                    required: true
                }
            ],
            throttling: {
                usages: 20,
                duration: 20
            }
        })
    }

    async run(action) {
        const items = await processSearch(action, action.interaction.options.getString("query"), true)
        if (!items) {
            return
        }

        /* get array of pages + array of results for each page to begin preparing the search page */

        const { pages, pageResults } = paginateSearchResults(items)

        /* search page state */

        let pageIndex = 0
        let isSearchComplete = false

        /* send search page and listen for additional interactions */

        const collector = action.interaction.channel.createMessageComponentCollector({ 
            time: INTERACT_LIFETIME * 60 * 1000, 
            filter: i => i.user.id === action.interaction.member.user.id, /* we only care about interactions from the member who asked */
            message: await action.updateReply({...getSearchPageMessage(pageIndex, pages, pageResults), fetchReply: true }) 
        })

        collector.on("end", () => action.setExpiredInteraction())
        collector.on("collect", async i => {
            if (isSearchComplete) {
                /* exit the completion state and redisplay search options if the user wants to select again */
                if (i.customId === SELECT_SEARCH_BUTTON_ID) {
                    isSearchComplete = false
                    action.setUpdateInteraction(i)
                    action.updateReply(getSearchPageMessage(pageIndex, pages, pageResults))
                }
            } else if (i.customId === RESULT_SELECT_MENU_ID) {
                /* validate the selected search result */
                const index = parseInt(i.values[0])
                if (!isNaN(index) && index >= 0 && index < items.length) {
                    /* enter the completion state and process playing the search result */
                    isSearchComplete = true
                    action.setUpdateInteraction(i, appendSelectSearch)
                    await processPlay(action, [items[index]])
                }
            } else {
                /* otherwise simply update the search page */
                pageIndex = getPageIndexFromButtonId(i.customId, pageIndex, pages.length)
                action.setUpdateInteraction(i)
                action.updateReply(getSearchPageMessage(pageIndex, pages, pageResults))
            }
        })
    }
}