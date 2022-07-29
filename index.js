/* attempt to load environment variables from dotenv */

try {
    require("dotenv").config()
} catch(e) {
    if (process.env.NODE_ENV !== "production") {
        console.warn("Failed to environment variables from dotenv. This isn't an issue if they are loaded in from elsewhere.")
    }
}

/* catch exceptions to keep process alive */

process.on('uncaughtException', console.error)

/* requirements */

const Discord = require("discord.js")
const { generateDependencyReport } = require('@discordjs/voice')

const { GuildManager } = require("./structures")
const { version } = require('./package.json')

/* set debug info */

process.env.PRESENT_MIC_DEBUG_INFO = [
    `Discord Present Mic v${version} - ${process.env.NODE_ENV === "production" ? "Production" : "Development"}`, 
    "@discordjs/voice Dependency Report",
].join("\n--------------------------------------------------\n") + "\n" + generateDependencyReport()

console.log(process.env.PRESENT_MIC_DEBUG_INFO)

/* instantiate the client with proper gateway intents */

const client = new Discord.Client({ intents: ["GUILD_VOICE_STATES", "GUILD_MESSAGES", "GUILDS"] })

/* connect to client events */

client.once("ready", () => {
    console.log(`Logged in as ${client.user.tag}!`)
    
    /* set activity to maintenance or ready */
    client.user.setActivity(process.env.MAINTENANCE === "true" ? "maintenance" : "music from YouTube!", { type: "PLAYING" })
    
    /* register all guilds in cache */
    console.log("Registering Guilds")
    for (const guild of client.guilds.cache.values()) {
        GuildManager.register(guild, client)
    }
})

client.on("error", console.error)
client.on("guildCreate", guild => GuildManager.register(guild, client))
client.on("guildDelete", guild => GuildManager.unregister(guild))
client.on("voiceStateUpdate", (oldState, newState) => {
    const manager = GuildManager.managers.get(oldState.guild.id)
    if (manager && manager.guild.available) {
        manager.music.handleVoiceStateUpdate(oldState, newState)
    }
})
client.on("interactionCreate", async interaction => {
    /* 
        we only care about commands in guilds 
    */
    if (interaction.isCommand() && interaction.inGuild()) {
        /* 
            turn them away if we are undergoing maintenance 
        */
        if (process.env.MAINTENANCE === "true") {
            interaction.reply({ content: "I am undergoing maintenance for my mic! :raised_hand: Ask me later!", ephemeral: true })
        } else {
            /* 
                find the manager and let their GuildCommandManager handle the interaction if it exists || turn them away if the manager doesn't exist yet
            */
            const manager = GuildManager.managers.get(interaction.guild.id) 
            if (manager && manager.guild.available) {
                manager.commands.handle(interaction, manager)
            } else {
                interaction.reply({ content: "This guild isn't ready for my presence yet! :raised_hand: Ask me later!", ephemeral: true })
            }
        }
    }
})

/* login */

client.login(process.env.TOKEN)