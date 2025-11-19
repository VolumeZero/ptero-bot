const fs = require("fs");
const {createNodeStatusEmbed} = require("../utils/embeds");
const { getErrorMessage } = require("../utils/clientErrors");

module.exports = {
    updateNodeStatusEmbeds: async function (client, seconds) {
        console.log("Watching node status embeds to update every " + seconds + " seconds...");
        const updateEmbeds = async () => {
            let dataDir = "./ptero/data";
            if (!fs.existsSync(dataDir)){
                console.log("Data directory not found, creating...");
                fs.mkdirSync(dataDir, { recursive: true });
            }

            let statusMessages = [];
            try {
                statusMessages = JSON.parse(fs.readFileSync("./ptero/data/nodeStatusMessages.json"));
            } catch (error) {
                console.warn("Could not load existing node status messages, creating new file.");
                fs.writeFileSync("./ptero/data/nodeStatusMessages.json", JSON.stringify(statusMessages, null, 4));
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
                        fs.writeFileSync("./ptero/data/nodeStatusMessages.json", JSON.stringify(statusMessages, null, 4));
                        continue;
                    }
                    
                    const embed = await createNodeStatusEmbed(msgInfo.nodeId);
                    await message.edit({ embeds: [embed] });
                } catch (error) {
                    console.error(`Error updating node status embed for node ID ${msgInfo.nodeId}:`, getErrorMessage(error));
                }
            }
        };

        // Run once immediately
        updateEmbeds();
        // Then run at the specified interval
        setInterval(updateEmbeds, seconds * 1000);
    }   
};
