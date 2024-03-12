# osu!mania botter
A discord-bot for the osu! gamemode mania. Capable of displaying online scores, storing unranked scores and tracking users (+ more)

Requirements: 
1. [Node](https://nodejs.org/en)
2. [Discord Bot](https://discordjs.guide/preparations/setting-up-a-bot-application.html#creating-your-bot)
3. [osu! OAuth](https://osu.ppy.sh/docs/index.html#registering-an-oauth-application)

If you have all the requirements, clone this repository and navigate to the folder you cloned it to. Paste the relevant information into .env-default and change the filename to .env. You can find your discord ID by enabling devloper mode on Discord and right-clicking your name. 

To run the application, open up a terminal window, navigate to the root of the repository and type the following commands:

```
npm install
node app.js
```

You might need to use sudo before the command depending on how your PC is setup.

After this your bot should be up and running and all you need to do is add it to your server. You can interface with the bot completly via discord.