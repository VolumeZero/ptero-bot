
const Nodeactyl = require("nodeactyl");
const { pterodactyl, SERVER_STATUS_UPDATE_INTERVAL } = require("../../config.json");
const { loadApiKey } = require("../keys");
const fs = require("fs");
const { createServerStatusEmbed } = require("../utils/embeds");


async function sendServerStatusEmbed(interaction, serverId, iconUrl) {
    //defer reply
    await interaction.deferReply({ ephemeral: true });

    const clientApiKey = await loadApiKey(interaction.user.id);
    if (!clientApiKey) {
        return interaction.reply({
            content: "You have not set your API key yet. Please use `/pt key` to set it.",
            ephemeral: true,
        });
    }
    const pteroClient = new Nodeactyl.NodeactylClient(pterodactyl.domain, clientApiKey);
    const serverDetails = await pteroClient.getServerDetails(serverId);
    if (!serverDetails) {
        return interaction.reply({
            content: "Could not retrieve server details. Please ensure the server ID is correct and your API key has access to this server.",
            ephemeral: true,
        });
    }

    let statusMessages = null;
    try {
        statusMessages = JSON.parse(fs.readFileSync("./ptero/data/statusMessages.json"));
    } catch (error) {
        statusMessages = [];
        console.warn("Could not load existing status messages, creating new file.");
        fs.writeFileSync("./ptero/data/statusMessages.json", JSON.stringify(statusMessages, null, 4));
    }

    //check if an existing embed message for this server exists
    const existingEmbed = statusMessages.find(msg => msg.serverId === serverId);
    //remove existing embed message from channel if it exists
    if (existingEmbed) {
        try {
            console.log("Deleting existing status message...");
            const channel = await interaction.client.channels.fetch(existingEmbed.channelId);
            const message = await channel.messages.fetch(existingEmbed.messageId);
            await message.delete();
        } catch (error) {
            console.error("Error deleting existing status message:", error);
        }
        //remove from statusMessages array
        const index = statusMessages.indexOf(existingEmbed);
        if (index > -1) {
            statusMessages.splice(index, 1);
        }
    }

    const embed = await createServerStatusEmbed(serverId, clientApiKey, iconUrl);

    //send to the current channel and save the message ID for future updates
    const message = await interaction.channel.send({ embeds: [embed] });
    statusMessages.push({ serverId: serverId, messageId: message.id, channelId: interaction.channel.id, iconUrl: iconUrl, userId: interaction.user.id }); //save the user id so we can use their api key later to update the embed
    //save statusMessages array to json file
    fs.writeFileSync("./ptero/data/statusMessages.json", JSON.stringify(statusMessages, null, 4));
    interaction.followUp({ content: `Status embed sent for server **${serverDetails.name}**. It will update every ${SERVER_STATUS_UPDATE_INTERVAL} seconds.`, ephemeral: true });
}

module.exports = {
    sendServerStatusEmbed,
};