/* detect production or dev build */
console.log(`${process.env.NODE_ENV === "PRODUCTION" ? "Production" : "Development"} Environment Detected`)

try {
    require("dotenv").config()
} catch(e) {
    if (process.env.NODE_ENV !== "PRODUCTION") {
        console.warn("Failed to environment variables from dotenv. This isn't an issue if they are loaded in from elsewhere.")
    }
}

/* HACKY AF CODE */
/* the webm demultiplexer has a default highWaterMark of 16kB */
/* this property was exposed in djs v12 but no longer in v13 */
/* after backtracking through @discordjs/voice source code for creating AudioResources I found the class that builds the Transform stream and overwrote it */
/* now the default highWaterMark is 32kb and is adjustable here */
{
    const prism = require("prism-media")
    prism.opus.WebmDemuxer = class WebmDemuxerHack extends prism.opus.WebmDemuxer {
        constructor(options = {}) {
            super(Object.assign({ highWaterMark: 32 }, options))
        }
    }
}
/***************************************************************/

const Discord = require("discord.js")
const { generateDependencyReport } = require("@discordjs/voice")

const { GuildManager } = require("./structures")

/* output voice dependencies */

console.log("@discordjs/voice Dependency Report")
console.log(generateDependencyReport())

/* instnatiate the client with proper gateway intents */

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