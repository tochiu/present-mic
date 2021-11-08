# Discord Present Mic

  

Present Mic is a *My Hero Academia* inspired Discord music bot built on [Node.js](https://nodejs.org/  "Node.js Website") 16 and uses [Discord.js](https://discord.js.org/  "Discord.js Website") v13 to interface with the Discord API.

## Invite To Your Server ##

  

Click [here](https://discord.com/api/oauth2/authorize?client_id=898104335387467786&permissions=274914692096&scope=bot%20applications.commands  "Discord Invite Link") to invite the bot to your server. This bot is not yet verified to run in 100 or more servers.

## Slash Commands ##

 - **`play [query]`**: Search YouTube for `query` and queue up the first result found. Direct YouTube video and playlist links are supported.
 - **`remove [positions]`**: Remove items in the queue at the specified positions. `positions` must be a comma-separated list of either a specific position or inclusive range (ex: `4, 8-12, 16, 20-24`).
 - **`move [position] [new_position]`**: Moves items at `position` to `new_position`. `position` can be a range but `new_position` cannot (ex: `8-12, 4`).
 - **`loop`**: Enable or disable looping
 - **`skip`**: Skip the now playing item
 - **`clear`**: Remove all items from the queue and stop playback
 - **`queue`**: Display the queue
 - **`disconnect`**: Disconnect the bot from the voice channel
 - **`invite`**: Generate a link to invite the bot to a server
 - **`nerd`**: Output version and generate a dependency report of audio-relevant technologies

  




  

## Host My Own ##

### Before You Begin ###
  
1. Make sure you have installed [Node.js](https://nodejs.org/  "Node.js Website") v16 or higher, [Git](https://git-scm.com/book/en/v2/Getting-Started-Installing-Git) and [ffmpeg](https://ffmpeg.org/).
2. [Create a Discord bot application.](https://discordjs.guide/preparations/setting-up-a-bot-application.html#creating-your-bot) Please see the [Environment Variables](#environment-variables) section to know how to store your  bot's token and client ID.
3. Obtain access to Google's YouTube Data API v3. Follow the first three steps in the **Before You Start** section of [this guide](https://developers.google.com/youtube/v3/getting-started) and please be sure to create an **API Key** instead of an OAuth 2.0 token.

### Installation ###

1. Clone this repository with `git clone https://github.com/tochiu/discord-present-mic`
2. Run `cd discord-present-mic` to move in the folder that Git has just created.
3. Run `npm install`. If you are on Windows please follow the [Caveat for Windows](#caveat-for-windows) section first before running this command.
 
### Caveat for Windows ###

Extra steps must be taken for hosting on Windows to ensure the `sodium` encryption library builds properly.

1. [Make sure Build Tools 2015 are installed.](https://www.microsoft.com/en-us/download/details.aspx?id=48159)
2. Install the  **Windows 8.1 SDK**  (it appears the  `node-addon-api`  module `sodium` is dependent on requires this). Microsoft maintains an archive of their SDKs  [here](https://developer.microsoft.com/en-us/windows/downloads/sdk-archive/). 
3. In your Windows environment variables, add `VCTargetsPath` and set it to `C:\Program Files (x86)\MSBuild\Microsoft.cpp\v4.0\v140`
4. Run  `npm config set msvs_version 2015`
5. Run `npm install` to verify success

If `sodium` continues to fail then run `npm uninstall sodium` followed with `npm i libsodium-wrappers`. This is an alternative encryption library.

### Environment Variables ###

If you don't already have a method of pushing environment variables to this application then you should run `npm i dotenv` and create a `.env` file in the project's root folder. Each line in a `.env` file should hold a `KEY=value` pair.

The following environment variables are required:

 - `PERMISSIONS_INT`: Set this to `274914692096`. This represents the permissions the bot needs from Discord to function.
 - `CLIENT_ID`: This is the ID of the bot and is found in your bot's application.
 - `TOKEN`: This is what is required to log into a Discord bot. This is also found in your bot's application. **This is very sensitive information and cannot be disclosed to anyone.**
 - `GAPI_KEY_0`, `GAPI_KEY_1`, `GAPI_KEY_2`, ... : This are the API keys used to access Google's YouTube Data API v3. If multiple API keys are supplied then they will be used in a randomized rotating order. This is only useful if each API key consumes separate qoutas. 
 
### Invite ###

Invite your self-hosted bot to servers with `https://discord.com/api/oauth2/authorize?client_id=[CLIENT_ID]&permissions=[PERMISSIONS_INT]&scope=bot%20applications.commands`. The `CLIENT_ID` and `PERMISSIONS_INT` are the same values you configured your environment variables to.

### Launch ###

In order to spin up the bot, run `npm start`. Enjoy!
