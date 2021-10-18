require('dotenv').config()

const Discord = require('discord.js')
const { generateDependencyReport } = require('@discordjs/voice')

const { GuildManager } = require('./structures')

/* output voice dependencies */

console.log("@discordjs/voice Dependency Report")
console.log(generateDependencyReport())

/* instnatiate the client with proper gateway intents */

const client = new Discord.Client({ intents: ['GUILD_VOICE_STATES', 'GUILD_MESSAGES', 'GUILDS'] })

/* connect to client events */

client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`)
    
    client.user.setActivity(process.env.MAINTENANCE === "true" ? "maintenance" : "music from YouTube!", { type: "PLAYING" })

    console.log('Registering Guilds')
    for (const guild of client.guilds.cache.values()) {
        GuildManager.register(guild, client)
    }
})

client.on('error', console.error)
client.on('guildCreate', guild => GuildManager.register(guild, client))
// client.on('voiceStateUpdate', async (oldState, newState) => {
//     /* this is only to know when the client left */
//     let manager = GuildManager.managers.get(newState.guild.id)
//     if (manager) {
//         manager.music.updateMemberVoiceState(oldState, newState)
//     }
// })

client.on('interactionCreate', async interaction => {
    if (interaction.isCommand() && interaction.inGuild()) {
        const manager = GuildManager.managers.get(interaction.guild.id) 
        if (manager && manager.guild.available) {
            manager.commands.handle(interaction, manager)
        } else {
            interaction.reply({ content: "This guild isn't ready for my presence yet! :raised_hand: Ask me later!", ephemeral: true })
        }
    }
})

client.login(process.env.TOKEN)