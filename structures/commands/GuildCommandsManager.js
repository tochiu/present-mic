const { resolve } = require('path')
const { readdir } = require('fs').promises

const { MessageActionRow, MessageButton, Constants } = require('discord.js')

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
 * A GuildCommandInteraction is a bundle that includes extra information about the CommandInteraction
 * relevant for the functioning of each command
 */
class GuildCommandInteraction {
    constructor(interaction, manager) {
        this.interaction = interaction
        this.manager = manager
        this._deferring = undefined
        this._updateInteraction = undefined
        this._updateInteractionEditor = undefined
        this._optionsLast = undefined
    }

    setUpdateInteraction(updateInteraction, updateInteractionEditor) {
        this._updateInteraction = updateInteraction
        this._updateInteractionEditor = updateInteractionEditor
    }

    async setExpiredInteraction() {
        this.setUpdateInteraction()

        if (!this._optionsLast || this._optionsLast.components.length === 0) {
            return
        }

        const options = Object.assign({}, this._optionsLast)
        options.components = [
            new MessageActionRow()
                .addComponents(
                    new MessageButton()
                        .setCustomId("interaction_expired")
                        .setLabel("Interaction Expired")
                        .setStyle(Constants.MessageButtonStyles.SECONDARY)
                        .setDisabled(true)
                )
        ]

        return this.updateReply(options)
    }
    
    async deferReply(options) {
        if (this._deferring) {
            throw "Reply already deferred"
        }
        const deferring = this.interaction.deferReply(options)
        this._deferring = deferring
        return deferring
    }

    async updateReply(options) {
        if (typeof options === "string") {
            options = { content: options }
        }

        if (options.content === undefined) {
            options.content = " "
        }

        if (options.embeds === undefined) {
            options.embeds = []
        }

        if (options.files === undefined) {
            options.files = []
        }

        if (options.components === undefined) {
            options.components = []
        }

        if (options.stickers === undefined) {
            options.stickers = []
        }

        if (options.attachments === undefined) {
            options.attachments = []
        }
        
        const { interaction, _deferring } = this

        if (this._updateInteraction && this._updateInteractionEditor) {
            options = this._updateInteractionEditor(options)
        }

        this._optionsLast = options 
        
        if (_deferring) {
            await _deferring

            if (this._optionsLast !== options) {
                return
            }
        }

        if (this._updateInteraction) {
            return this._updateInteraction.update(options)
        } else if (interaction.replied) {
            return interaction.followUp({ ...options, ephemeral: interaction.ephemeral })
        } else if (interaction.deferred) {
            return interaction.editReply(options)
        } else {
            return interaction.reply(options)
        }
    }
}

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

        const action = new GuildCommandInteraction(interaction, manager)

        /* execute command */
        try {
            await command.handle(action)
        } catch (e) {
            /* command error */
            console.error("Command execution error")
            console.error(e)

            action.updateReply({ content: this._commandErrorMessage + this._ownerContact, ephemeral: true })
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