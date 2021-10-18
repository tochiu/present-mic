const { resolve } = require('path')
const { readdir } = require('fs').promises
const { REST } = require('@discordjs/rest')
const { Routes } = require('discord-api-types/v9')
const { SlashCommandBuilder } = require('@discordjs/builders')

const BaseCommand = require('./BaseCommand')

/* https://stackoverflow.com/a/45130990 */

async function getFiles(dir) {
    const dirents = await readdir(dir, { withFileTypes: true })
    const files = await Promise.all(dirents.map((dirent) => {
        const res = resolve(dir, dirent.name)
        return dirent.isDirectory() ? getFiles(res) : res
    }))
    return Array.prototype.concat(...files)
}

const commandClasses = (async () => {
    const commands = []
    const files = await getFiles(__dirname)
    for (const filename of files) {
        if (__dirname === __filename) {
            continue
        }

        const module = require(filename)
        if (module === BaseCommand || !(module.prototype instanceof BaseCommand)) {
            continue
        }

        commands.push(module)
    }

    return commands
})()

class GuildCommandsManager {
    
    constructor(guild, client) {
        this.client = client
        this.guild = guild
        this.map = new Map()
        console.log(`Loading "${guild.name}" commands.`)
        this._load()
            .then(() => console.log(`Successfully loaded "${guild.name}" commands.`))
            .catch(console.error)
    }

    handle(interaction, manager) {
        /* validate command */
        const command = this.map.get(interaction.commandName)
        if (!command) {
            interaction.reply({ content: "Sorry! :man_shrugging: I don't know how to execute this command!", ephemeral: true })
            return
        }
        
        /* run command */
        try {
            try {
                command.run(interaction, manager)
            } catch (e) {
                command.onError(e, interaction, manager)
            }
        } catch (e) {
            console.error("Command execution error handler error")
            console.error(e)
            interaction.reply({ content: "Yikes! :scream: Somethin' went **horribly** wrong tryna run this command!", ephemeral: true })
        }
    }

    async _load() {
        const commands = this.map
        const body = []

        for (const commandClass of await commandClasses) {
            const command = new commandClass(this.client)
            commands.set(command.config.name, command)

            if (command.config.hidden) {
                continue
            }

            const slashCommand = new SlashCommandBuilder()
                .setName(command.config.name)
                .setDescription(command.config.description.substring(0, 100))

            if (command.buildSlashCommand) {
                command.buildSlashCommand(slashCommand)
            }

            body.push(slashCommand.toJSON())
        }
        
        await new REST({ version: '9' })
            .setToken(process.env.TOKEN)
            .put(Routes.applicationGuildCommands(process.env.CLIENT_ID, this.guild.id), { body })
    }
}

module.exports = GuildCommandsManager