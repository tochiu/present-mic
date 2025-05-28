import { BaseCommand } from '../BaseCommand.js'

export class LoopCommand extends BaseCommand {
    constructor(client) {
        super(client, {
            name: "loop",
            description: "Enable or disable looping",
            throttling: {
                usages: 2,
                duration: 1
            }
        })
    }

    async run(action) {
        const { interaction, manager } = action
        let connectedChannelId = manager.guild.me && manager.guild.me.voice.channelId
        if (!connectedChannelId) {
            action.updateReply({ content: ":face_with_raised_eyebrow: I ain't in a voice channel...", ephemeral: true })
            return
        }

        if (connectedChannelId !== interaction.member.voice.channelId) {
            action.updateReply({ content: "You ain't even listenin' to me! :anger: Why would I listen to ya?!", ephemeral: true })
            return
        }

        if (!manager.music.getState().playing) {
            action.updateReply({ content: ":face_with_raised_eyebrow: I ain't playin' anything...", ephemeral: true })
            return
        }

        const looping = manager.music.toggleLoop()

        action.updateReply(`${looping ? ":white_check_mark:" : ":x:"} :repeat_one:`)
    }
}