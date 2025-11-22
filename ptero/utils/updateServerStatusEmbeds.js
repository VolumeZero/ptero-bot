const fs = require("fs");
const { loadApiKey } = require("../keys");
const { getErrorMessage } = require("./clientErrors");
const { createServerStatusEmbed } = require('./embeds');

module.exports = {
    updateServerStatusEmbeds: async function (client, seconds) {
        console.log("Watching server status embeds to update every " + seconds + " seconds...");

        const updateEmbeds = async () => {
            let dataDir = "./ptero/data";
            if (!fs.existsSync(dataDir)){
                console.log("Data directory not found, creating...");
                fs.mkdirSync(dataDir, { recursive: true });
            }

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

                    if (!msgInfo.userId) {
                        console.log(`No user ID associated with message ID ${msgInfo.messageId}, cannot load API key, removing...`);
                        //remove from statusMessages array
                        const index = statusMessages.indexOf(msgInfo);
                        if (index > -1) {
                            statusMessages.splice(index, 1);
                        }
                        //save updated statusMessages array to json file
                        fs.writeFileSync("./ptero/data/statusMessages.json", JSON.stringify(statusMessages, null, 4));
                        continue;
                    }

                    const apiKey = await loadApiKey(msgInfo.userId);
                    if (!apiKey) {
                        console.log(`No API key found for user ID ${msgInfo.userId}, skipping update for server ID  ${msgInfo.serverId} and removing embed from list...`);
                        //remove from statusMessages array
                        const index = statusMessages.indexOf(msgInfo);
                        if (index > -1) {
                            statusMessages.splice(index, 1);
                        }
                        //save updated statusMessages array to json file
                        fs.writeFileSync("./ptero/data/statusMessages.json", JSON.stringify(statusMessages, null, 4));
                        continue;
                    }  

                    if (msgInfo.enableLogs === undefined) {
                        msgInfo.enableLogs = false; //default to false for older embeds
                        fs.writeFileSync("./ptero/data/statusMessages.json", JSON.stringify(statusMessages, null, 4));
                    }

                    const embed = await createServerStatusEmbed(msgInfo.serverId, apiKey, msgInfo.iconUrl);
                    
                    await message.edit({ embeds: [embed] });

                    //sleep for 1 second to avoid rate limits
                    await new Promise(resolve => setTimeout(resolve, 1000));
                } catch (error) {
                    console.error(`Error updating status embed for server ID ${msgInfo.serverId}:`, getErrorMessage(error));
                }
            }
        };

        // Run once immediately
        updateEmbeds();

        // Then continue interval
        setInterval(updateEmbeds, seconds * 1000);
    }
};


