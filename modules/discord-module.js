// Require the necessary discord.js classes
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');

// Create a new client instance
const client = new Client({
    intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.MessageContent
    ]
})

module.exports = {
    client: client,
    EmbedBuilder: EmbedBuilder
}