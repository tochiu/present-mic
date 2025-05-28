import { GuildMusicManager } from '../music/GuildMusicManager.js'
import { GuildCommandsManager } from '../commands/GuildCommandsManager.js'

/**
 * Manages a single guild
 */
export class GuildManager {

    static managers = new Map()

    static register(guild, client) {
        if (GuildManager.managers.has(guild.id)) {
            return
        }
        console.log(`Registering Guild "${guild.name}" <${guild.id}>`)
        GuildManager.managers.set(guild.id, new GuildManager(guild, client))
    }

    static unregister(guild) {
        if (GuildManager.managers.has(guild.id)) {
            console.log(`Unregistering Guild "${guild.name}" <${guild.id}>`)

            /* currently no additional work is required */
            GuildManager.managers.delete(guild.id)
        }
    }

    constructor(guild, client) {
        this.guild = guild
        this.client = client

        this.music = new GuildMusicManager(guild, client)
        this.commands = new GuildCommandsManager(guild, client)
    }
}