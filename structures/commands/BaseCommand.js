class BaseCommand {
    constructor(client, config) {
        this.client = client
        this.config = config

        this.usages = 0
        this.timestamp = 0
    }

    async run() {
        console.log("BaseCommand ran!")
    }

    async handle(interaction, manager) {
        /* check rate limit */
        if (this.config.throttling) {
            const { usages, duration } = this.config.throttling

            if ((Date.now() - this.timestamp)/1000 > duration) {
                this.usages = 0
                this.timestamp = Date.now()
            }

            if (this.usages >= usages) {
                interaction.reply({
                    content: `This command has been used too many times! :raised_hand: Try again in \`${Math.ceil(duration - (Date.now() - this.timestamp)/1000)}\` seconds.`, 
                    ephemeral: true
                })
                return
            }

            this.usages++
        }

        /* run command */
        await this.run(interaction, manager)
    }
}

module.exports = BaseCommand