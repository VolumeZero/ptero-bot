const fs = require("fs");
const { loadApiKey } = require("../keys");
const { createServerStatusEmbed } = require('./embeds');
const { pterodactyl } = require("../../config.json");

module.exports = {
    updateServerStatusEmbeds: async function (client, seconds) {
        let numOfEmbeds = 0;
        const updateEmbeds = async () => {
            let time = new Date()
            let dataDir = "./ptero/data";
            if (!fs.existsSync(dataDir)){
                console.log("Data directory not found, creating...");
                fs.mkdirSync(dataDir, { recursive: true });
            }
            const filePath = "./ptero/data/statusMessages.json";

            let statusMessages = [];
            try {
                statusMessages = JSON.parse(fs.readFileSync(filePath));
            } catch (error) {
                console.warn("Could not load existing status messages, creating new file.");
                fs.writeFileSync(filePath, JSON.stringify(statusMessages, null, 4));
            }

            const tasks = statusMessages.map(async (msgInfo) => {
                try {
                    const channel = await client.channels.fetch(msgInfo.channelId);
                    const message = await channel.messages.fetch(msgInfo.messageId).catch(() => null);
                    if (!message) {
                        const index = statusMessages.indexOf(msgInfo);
                        if (index > -1) statusMessages.splice(index, 1);
                        fs.writeFileSync(filePath, JSON.stringify(statusMessages, null, 4));
                        return;
                    }
                
                    if (!msgInfo.userId) {
                        const index = statusMessages.indexOf(msgInfo);
                        if (index > -1) statusMessages.splice(index, 1);
                        fs.writeFileSync(filePath, JSON.stringify(statusMessages, null, 4));
                        return;
                    }
                
                    const apiKey = await loadApiKey(msgInfo.userId);
                    if (!apiKey) {
                        const index = statusMessages.indexOf(msgInfo);
                        if (index > -1) statusMessages.splice(index, 1);
                        fs.writeFileSync(filePath, JSON.stringify(statusMessages, null, 4));
                        return;
                    }
                
                    if (msgInfo.enableLogs === undefined) {
                        msgInfo.enableLogs = false;
                        fs.writeFileSync(filePath, JSON.stringify(statusMessages, null, 4));
                    }
                
                    const embed = await createServerStatusEmbed(
                        msgInfo.serverId,
                        apiKey,
                        msgInfo.iconUrl,
                        msgInfo.enableLogs,
                        msgInfo.gameType
                    );
                
                    message.edit({ embeds: [embed] });
                    numOfEmbeds++;
                
                } catch (err) {
                    if (pterodactyl.ERROR_LOGGING_ENABLED) {
                        console.error(`Error updating embed for ${msgInfo.serverId}:`, err);
                    }
                }
            });
            await Promise.all(tasks);

            const msElapsed = new Date() - time;
            //console.log(`🕒 Updated ${numOfEmbeds} server status embed(s) in ${msElapsed} ms.`);
            numOfEmbeds = 0; //reset for next interval
        };


        // Run once immediately
        updateEmbeds();
        console.log(`⌛ Watching server status embed(s) for updates every ${seconds} second(s)...`);
        // Then continue interval
        setInterval(updateEmbeds, seconds * 1000);
    }
};


