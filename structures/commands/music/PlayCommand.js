const unescape = require("unescape")
const { MessageEmbed } = require("discord.js")

const BaseCommand = require('../BaseCommand')
const { formatSeconds } = require("../util")

const { colorPrimary } = require("../../../config.json")

module.exports = class PlayCommand extends BaseCommand {
    constructor(client) {
        super(client, {
            name: 'play',
            aliases: ['p'],
            group: 'music',
            memberName: 'play',
            description: 'Search and queue up an item. Direct YouTube video and playlist links are supported.',
            throttling: {
                usages: 60,
                duration: 60
            },
            guildOnly: true
        })
    }

    buildSlashCommand(slashCommandBuilder) {
        slashCommandBuilder.addStringOption(option => option.setName("query").setDescription("YouTube search query").setRequired(true))
    }
    
    async run(interaction, manager) {
        
        const query = interaction.options.getString("query").trim() // message.argString.trim()
        if (!query) {
            interaction.reply({ content: ":pinched_fingers: Gimme somethin' that makes sense kiddo!", ephemeral: true })
            return
        }
        
        const deferring = interaction.deferReply({ ephemeral: true })
        
        let result
        try {
            result = await manager.music.play(query, interaction.member.voice.channel, interaction.member)
        } catch(e) {
            console.error(e)
            result = {
                success: false,
                reason: e.code === "VOICE_JOIN_CHANNEL" 
                    ? "I was blocked from joining ya channel! :sob: Make sure I got proper access!" 
                    : "Ask again later my mic is acting up!"
            }
        }

        if (result.success) {
            interaction.editReply(`Your request has been honored boss!`)

            if (result.items.length === 1) {
                const item = result.items[0]
                if (result.isPlayingNow) {
                    await deferring
                    interaction.followUp(`**Performing** :microphone: \`${unescape(item.snippet.title)}\` **now!**`)
                } else {
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
                    interaction.followUp({ embeds: [embed] })
                }
            } else {
                const embed = new MessageEmbed()
                embed.setColor(colorPrimary)
                embed.setAuthor("Performance Set Queued")
                embed.addField("Performances", `\`${result.items.length}\``, true)
                embed.addField("Duration", formatSeconds(result.itemsDuration).toString(), true)
                embed.addField("Estimated Wait", formatSeconds(result.queueBeforeDuration + result.currentDurationLeft).toString(), true)
                embed.addField("Queue Position", result.isPlayingNow ? "_Now Performing_" : (result.itemsStart + 1).toString())

                await deferring
                interaction.followUp({ embeds: [embed] })
            }
        } else {
            await deferring
            interaction.editReply(result.reason)
        }
    }
}