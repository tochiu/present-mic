const unescape = require('unescape')
const { MessageEmbed } = require('discord.js')

const BaseCommand = require('../BaseCommand')
const { formatSeconds } = require('../util')

const { colorPrimary } = require('../../../config.json')

module.exports = class PlayCommand extends BaseCommand {
    constructor(client) {
        super(client, {
            name: "play",
            description: "Search and queue up an item. Direct YouTube video and playlist links are supported.",
            options: [
                {
                    name: "query",
                    type: "STRING",
                    description: "YouTube search query",
                    required: true
                }
            ],
            throttling: {
                usages: 60,
                duration: 60
            }
        })
    }

    async run(interaction, manager) {
        /* abort if query is nothing */
        const query = interaction.options.getString("query").trim()
        if (!query) {
            interaction.reply({ content: ":pinched_fingers: Gimme somethin' that makes sense kiddo!", ephemeral: true })
            return
        }

        /* abort if cant play */
        let result = manager.music.canPlay(interaction.member.voice.channel)
        if (!result.success) {
            interaction.reply({ content: result.reason, ephemeral: true })
            return
        }

        /* defer */
        const deferring = interaction.deferReply()

        /* attempt to query and play */
        try {
            result = await manager.music.play(query, interaction.member.voice.channel, interaction.member)
        } catch (e) {
            console.error(e)
            result = {
                success: false,
                reason: e.code === "VOICE_JOIN_CHANNEL"
                    ? "I was blocked from joining ya channel! :sob: Make sure I have proper access!"
                    : "Ask again later my mic is acting up!"
            }
        }

        if (result.success) {
            if (result.items.length === 1) { /* exactly one item was queued */
                const item = result.items[0]
                if (result.isPlayingNow) { /* that one item is current playing => print now playing message */
                    await deferring
                    interaction.editReply(`**Performing** :microphone: \`${unescape(item.snippet.title)}\` **now!**`)
                } else { /* that one item is not currently playing so it must be in queue => print item queue info */
                    const embed = new MessageEmbed()
                    embed.setColor(colorPrimary)
                    embed.setAuthor("Performance Queued")
                    embed.setThumbnail(item.snippet.thumbnails.default.url)
                    embed.setDescription(`[**${unescape(item.snippet.title)}**](https://www.youtube.com/watch?v=${item.id})`)
                    embed.addField("Channel", item.snippet.channelTitle, true)
                    embed.addField("Duration", formatSeconds(item.seconds).toString(), true)
                    embed.addField("Estimated Wait", formatSeconds(result.queueBeforeDuration + result.currentDurationLeft).toString(), true)
                    embed.addField("Queue Position", (result.itemsStart + 1).toString())

                    await deferring
                    interaction.editReply({ embeds: [embed] })
                }
            } else { /* multiple items were queued => print multi-item queue info */
                const embed = new MessageEmbed()
                embed.setColor(colorPrimary)
                embed.setAuthor("Performance Set Queued")
                embed.addField("Performances", `\`${result.items.length}\``, true)
                embed.addField("Duration", formatSeconds(result.itemsDuration).toString(), true)
                embed.addField("Estimated Wait", formatSeconds(result.queueBeforeDuration + result.currentDurationLeft).toString(), true)
                embed.addField("Queue Position", result.isPlayingNow ? "_Now Performing_" : (result.itemsStart + 1).toString())

                await deferring
                interaction.editReply({ embeds: [embed] })
            }
        } else { /* the play operation failed to complete */
            await deferring
            interaction.editReply(result.reason)
        }
    }
}