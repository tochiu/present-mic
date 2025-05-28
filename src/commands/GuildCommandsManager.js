import { fileURLToPath, pathToFileURL } from "url"
import { resolve, dirname } from "path"
import { readdir } from "fs/promises"
import { MessageActionRow, MessageButton, Constants } from "discord.js"
import { BaseCommand } from "./BaseCommand.js"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

async function getFiles(dir) {
    const dirents = await readdir(dir, { withFileTypes: true })
    const files = await Promise.all(
        dirents.map(dirent => {
            const res = resolve(dir, dirent.name)
            return dirent.isDirectory() ? getFiles(res) : res
        })
    )
    return Array.prototype.concat(...files)
}

/* promise that resolves to an array of command classes */
const gettingCommandClasses = (async () => {
    const commands = []
    const files = await getFiles(__dirname)
    for (const filename of files) {
        if (filename === __filename) continue

        const mod = await import(pathToFileURL(filename).href)
        // grab default export or fall back to the single named export
        const CommandClass = mod.default
            ?? Object.values(mod).find(exp =>
                typeof exp === "function"
                && exp.prototype instanceof BaseCommand
            )
        if (!CommandClass || CommandClass === BaseCommand) {
            continue
        }

        commands.push(CommandClass)
    }

    return commands
})()

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

        const options = { ...this._optionsLast }
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

        options.content ??= " "
        options.embeds ??= []
        options.files ??= []
        options.components ??= []
        options.stickers ??= []
        options.attachments ??= []

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
        } else if (interaction.replied || interaction.deferred) {
            return interaction.editReply({ ...options, ephemeral: interaction.ephemeral })
        } else {
            return interaction.reply(options)
        }
    }
}

export class GuildCommandsManager {
    constructor(guild, client) {
        this.client = client
        this.guild = guild
        this.map = new Map()

        this._ownerContact = ""
        this._commandErrorMessage = "Yikes! :scream: Somethin' went **horribly** wrong tryna run this command!"

        this.client.application.fetch()
            .then(application => {
                this._ownerContact = ` Might wanna contact **\`${application.owner.tag}\`** about this!`
            })
            .catch(console.error)

        this._register()
            .then(() => console.log(`Successfully registered "${this.guild.name}" commands.`))
            .catch(e => {
                console.error("Guild command registration error")
                console.error(e)

                if (this.guild.systemChannel) {
                    this.guild.systemChannel.send("Yikes! :scream: It appears I encountered an issue registering commands for this guild." + this._ownerContact)
                }

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
        const command = this.map.get(interaction.commandName)
        if (!command) {
            interaction.reply({ content: "Sorry! :man_shrugging: I don't know how to execute this command!", ephemeral: true })
            return
        }

        const action = new GuildCommandInteraction(interaction, manager)

        try {
            await command.handle(action)
        } catch (e) {
            console.error("Command execution error")
            console.error(e)
            action.updateReply({ content: this._commandErrorMessage + this._ownerContact, ephemeral: true })
        }
    }

    async _register() {
        console.log(`Registering "${this.guild.name}" commands`)

        const commands = this.map
        const body = []

        for (const CommandClass of await gettingCommandClasses) {
            const command = new CommandClass(this.client)
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