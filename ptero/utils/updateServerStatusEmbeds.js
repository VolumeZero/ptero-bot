const fs = require("fs");
const { loadApiKey } = require("../keys");
const { createServerStatusEmbed } = require('./embeds');
const { pterodactyl } = require("../../config.json");

module.exports = {
    updateServerStatusEmbeds: async function (client, seconds) {
        const updateEmbeds = async () => {
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
                const taskStart = Date.now();   
                try {
                    const channel = await client.channels.fetch(msgInfo.channelId, { cache: true });
                    const message = channel.messages.cache.get(msgInfo.messageId) || await channel.messages.fetch(msgInfo.messageId, { cache: true });
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
                        console.warn(`API key for user ${msgInfo.userId} not found. Removing server status embed from json for server ${msgInfo.serverId}.`);
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
                        msgInfo.serverType
                    );
                
                    await message.edit({ embeds: [embed] });
                
                } catch (err) {
                    if (pterodactyl.ERROR_LOGGING_ENABLED) {
                        console.error(`Error updating embed for ${msgInfo.serverId}:`, err);
                    }
                }

                return Date.now() - taskStart;
            });
            
            const results = await Promise.all(tasks);
            const validTimes = results.filter(ms => typeof ms === "number");
            const avgTime = validTimes.reduce((a, b) => a + b, 0) / validTimes.length;

            //console.log(`🕒 Updated ${validTimes.length} server embeds | Avg: ${avgTime.toFixed(1)} ms`);
        };


        // Run once immediately
        await updateEmbeds();
        console.log(`⌛ Watching server status embed(s) for updates every ${seconds} second(s)...`);
        // Then continue interval
        if (this._statusInterval) clearInterval(this._statusInterval);

        this._statusInterval = setInterval(updateEmbeds, seconds * 1000);

    }
};


