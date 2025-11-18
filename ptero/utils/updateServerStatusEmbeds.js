const { pterodactyl } = require("../../config.json");
const fs = require("fs");
const { getErrorMessage } = require("../clientErrors");
const { createServerStatusEmbed } = require('./embeds');

module.exports = {
    updateServerStatusEmbeds: async function (client, seconds) {
        const apiKey = pterodactyl.cl_apiKey;
        console.log("Watching server status embeds to update every " + seconds + " seconds...");

        const updateEmbeds = async () => {
            let statusMessages = [];
            try {
                statusMessages = JSON.parse(fs.readFileSync("./ptero/data/statusMessages.json"));
            } catch (error) {
                console.warn("Could not load existing status messages, creating new file.");
                fs.writeFileSync("./ptero/data/statusMessages.json", JSON.stringify(statusMessages, null, 4));
            }

            for (const msgInfo of statusMessages) {
                try {                   
                    const channel = await client.channels.fetch(msgInfo.channelId);
                    const message = await channel.messages.fetch(msgInfo.messageId).catch(() => null);
                    if (!message) {
                        console.log(`Message ID ${msgInfo.messageId} not found in channel ID ${msgInfo.channelId}, removing...`);
                        //remove from statusMessages array
                        const index = statusMessages.indexOf(msgInfo);
                        if (index > -1) {
                            statusMessages.splice(index, 1);
                        }
                        //save updated statusMessages array to json file
                        fs.writeFileSync("./ptero/data/statusMessages.json", JSON.stringify(statusMessages, null, 4));
                        continue;
                    }

                    const embed = await createServerStatusEmbed(msgInfo.serverId, apiKey, msgInfo.iconUrl);
                    
                    await message.edit({ embeds: [embed] });

                } catch (error) {
                    console.error(`Error updating status embed for server ID ${msgInfo.serverId}:`, getErrorMessage(error));
                    console.error(`Does the owners client API key have access to this server?`);
                }
            }
        };

        // Run once immediately
        updateEmbeds();

        // Then continue interval
        setInterval(updateEmbeds, seconds * 1000);
    }
};


