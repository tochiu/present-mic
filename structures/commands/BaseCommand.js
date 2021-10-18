/*
    const { escapeMarkdown } = require('discord.js')

    const owners = this.client.owners;
    const ownerList = owners ? owners.map((usr, i) => {
        const or = i === owners.length - 1 && owners.length > 1 ? 'or ' : '';
        return `${or}${escapeMarkdown(usr.username)}#${usr.discriminator}`;
    }).join(owners.length > 2 ? ', ' : ' ') : '';
    const invite = this.client.options.invite;
    
    return message.reply(
        `Yikes! :scream: Somethin' went horribly wrong tryna run a command!` + 
        `\nI dunno try again or phone in ${ownerList || 'the bot owner'}${invite ? ` in this server: ${invite}` : '.'}`
    )
*/

class BaseCommand {
    constructor(client, config) {
        this.client = client
        this.config = config
    }

    onError(e, interaction) {
        console.error(e)
        return interaction.reply({ content: "Yikes! :scream: Somethin' went horribly wrong tryna run this command!", ephemeral: true })
    }
}

module.exports = BaseCommand