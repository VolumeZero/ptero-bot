const Nodeactyl = require("nodeactyl");
const { pterodactyl } = require("../../config.json");
const fs = require("fs");
const { createNodeStatusEmbed } = require("../utils/embeds");

module.exports = {
    async sendNodeStatusEmbed(interaction, nodeId) {
        //defer 
        await interaction.deferReply({ ephemeral: true });

        const appApiKey = pterodactyl.apiKey;
        const pteroApp = new Nodeactyl.NodeactylApplication(pterodactyl.domain, appApiKey);

        const nodeDetails = await pteroApp.getNodeDetails(nodeId);
        if (!nodeDetails) {
            return interaction.reply({
                content: "Could not retrieve node details. Please ensure the node ID is correct.",
                ephemeral: true,
            });
        }
        
        //remove existing embed message from channel if it exists
        let statusMessages = null;
        try {
            statusMessages = JSON.parse(fs.readFileSync("./ptero/data/nodeStatusMessages.json"));
        } catch (error) {
            statusMessages = [];
            console.warn("Could not load existing node status messages, creating new file.");
            fs.writeFileSync("./ptero/data/nodeStatusMessages.json", JSON.stringify(statusMessages, null, 4));
        }
        const existingEmbed = statusMessages.find(msg => msg.nodeId === nodeId);
        if (existingEmbed) {
            try {
                console.log("Deleting existing node status message...");
                const channel = await interaction.client.channels.fetch(existingEmbed.channelId);
                const message = await channel.messages.fetch(existingEmbed.messageId);
                await message.delete().catch((error) => {
                    console.log("Failed to delete existing node status message, it may have already been deleted.");
                });
            } catch (error) {
                console.error("Error deleting existing node status message:", error);
            }
            //remove from statusMessages array
            const index = statusMessages.indexOf(existingEmbed);
            if (index > -1) {
                statusMessages.splice(index, 1);
            }
        }

        const embed = await createNodeStatusEmbed(nodeId);
        //send to the current channel
        //save message ID and channel ID to file for future updates
        const sentMessage = await interaction.channel.send({ embeds: [embed] });
        statusMessages.push({
            name: nodeDetails.name,
            nodeId: nodeId,
            channelId: interaction.channel.id,
            messageId: sentMessage.id,
        });
        fs.writeFileSync("./ptero/data/nodeStatusMessages.json", JSON.stringify(statusMessages, null, 4));
        
        interaction.followUp({
            content: `Node status embed for **${nodeDetails.name}** has been sent to this channel and will be updated every ${pterodactyl.NODE_STATUS_UPDATE_INTERVAL} seconds.`,
            ephemeral: true,
        });

    }
};