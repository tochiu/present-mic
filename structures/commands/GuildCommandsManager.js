const { resolve } = require('path')
const { readdir } = require('fs').promises

const BaseCommand = require('./BaseCommand')

/* recursive fs.readdir provided by https://stackoverflow.com/a/45130990 */
async function getFiles(dir) {
    const dirents = await readdir(dir, { withFileTypes: true })
    const files = await Promise.all(dirents.map((dirent) => {
        const res = resolve(dir, dirent.name)
        return dirent.isDirectory() ? getFiles(res) : res
    }))
    return Array.prototype.concat(...files)
}

/* promise that resolves to an array of command classes */
const gettingCommandClasses = (async () => {
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

/**
 * A GuildCommandsManager exists for each GuildManager. Registering slash commands and handling command interactions
 * for a guild are exclusively executed here.
 */
class GuildCommandsManager {

    constructor(guild, client) {
        this.client = client
        this.guild = guild
        this.map = new Map()

        this._ownerContact = ""
        this._commandErrorMessage = "Yikes! :scream: Somethin' went **horribly** wrong tryna run this command!"

        /**
         * TODO: place this owner contact logic inside the client since its independent of the guild
         */
        this.client.application.fetch()
            .then(application => {
                this._ownerContact = ` Might wanna contact **\`${application.owner.tag}\`** about this!`
            })
            .catch(console.error)

        this._register()
            .then(() => console.log(`Successfully registered "${this.guild.name}" commands.`))
            .catch((e) => {
                /* commands failed to register */
                console.error("Guild command registration error")
                console.error(e)

                /* send in system channel if it exists */
                if (this.guild.systemChannel) {
                    this.guild.systemChannel.send("Yikes! :scream: It appears I encountered an issue registering commands for this guild." + this._ownerContact)
                }

                /* dm server owner about the issue */
                this.guild.fetchOwner()
                    .then(owner => owner.createDM())
                    .then(dm => dm.send(`Hey! :wave: I encountered an issue registering commands for \`${this.guild.name}\`.${this._ownerContact}`))
                    .catch(e => {
                        console.error("Error encountered attempting to send command registration fail message to guild owner")
                        console.error(e)
                    })
            })
    }

    async handle(interaction, manager) {
        /* abort if not valid command */
        const command = this.map.get(interaction.commandName)
        if (!command) {
            interaction.reply({ content: "Sorry! :man_shrugging: I don't know how to execute this command!", ephemeral: true })
            return
        }

        /* execute command */
        try {
            await command.handle(interaction, manager)
        } catch (e) {
            /* command error */
            console.error("Command execution error")
            console.error(e)

            if (interaction.replied) {
                interaction.followUp({ content: this._commandErrorMessage + this._ownerContact, ephemeral: interaction.ephemeral })
            } else if (interaction.deferred) {
                interaction.editReply(this._commandErrorMessage + this._ownerContact)
            } else {
                interaction.reply({ content: this._commandErrorMessage + this._ownerContact, ephemeral: true })
            }
        }
    }

    async _register() {
        console.log(`Registering "${this.guild.name}" commands.`)

        const commands = this.map
        const body = []

        /* build body for registering slash commands to the guild */

        for (const commandClass of await gettingCommandClasses) {
            const command = new commandClass(this.client)
            commands.set(command.config.name, command)

            if (command.config.hidden) {
                continue
            }

            const { name, description, options } = command.config
            body.push({ name, description, options })
        }

        await this.guild.commands.set(body)
    }
}

module.exports = GuildCommandsManager