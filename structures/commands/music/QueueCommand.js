const unescape = require("unescape")
const { MessageEmbed } = require('discord.js')

const BaseCommand = require('../BaseCommand')
const { formatSeconds } = require('../util')

const { colorPrimary } = require("../../../config.json")

function getQueueItemDescription(item, index) {
    
    return `${index ? `\`${index}.\` ` : ""}`
        + `[${unescape(item.snippet.title)}](https://www.youtube.com/watch?v=${item.id})`
        + ` | \`${formatSeconds(item.seconds)}`
        + ` Requested by: ${item.requester.nickname || item.requester.user.tag}${item.requester.nickname ? ` (${item.requester.user.tag})` : ""}\``
}

const placeholder = "⠀"

function createEmbedsFromQueueState(guild, state) {
    const embeds = []

    let embedFieldCount = 0
    let embed = new MessageEmbed()

    embed.setColor(colorPrimary)
    embed.setTitle(`Performance Queue for ${guild.name}`)

    if (state.playing) {
        embed.addField(placeholder, `__Now Performing:__\n${getQueueItemDescription(state.playing)}`)
        embedFieldCount = 1
    }

    if (state.queue.length > 0) {
        let totalSeconds = 0
        const fieldArgs = state.queue.map((item, index) => {
            totalSeconds += item.seconds
            return [placeholder, getQueueItemDescription(item, index + 1)]
        })

        fieldArgs.push([`${placeholder}\n${fieldArgs.length} songs in queue | ${formatSeconds(totalSeconds)} total in length`, placeholder])
        
        if (state.playing) {
            fieldArgs[0][1] = "__Up Next:__\n" + fieldArgs[0][1]
        }

        let startIndex = 0
        
        while (startIndex < fieldArgs.length && embeds.length < 10) {
            const addFieldCount = Math.min(25 - embedFieldCount, fieldArgs.length - startIndex)

            for (i = 0; i < addFieldCount; i++) {
                //console.log(fieldArgs[startIndex + i][0], fieldArgs[startIndex + i][1])
                embed.addField(fieldArgs[startIndex + i][0], fieldArgs[startIndex + i][1])
            }

            embeds.push(embed)

            embedFieldCount = 0
            embed = new MessageEmbed()
            embed.setColor(colorPrimary)

            startIndex += addFieldCount
        }
    }

    if (embeds.length === 0) {
        embeds.push(embed)
    }

    return embeds
}

module.exports = class QueueCommand extends BaseCommand {
    constructor(client) {
        super(client, {
            name: 'queue',
            aliases: ['q'],
            group: 'music',
            memberName: 'queue',
            description: 'Displays the current queue',
            throttling: {
                usages: 1,
                duration: 2
            },
            guildOnly: true
        })
    }
    
    async run(interaction, manager) {
        interaction.reply({ embeds: createEmbedsFromQueueState(interaction.guild, manager.music.getState()) })
    }
}