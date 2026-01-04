const fs = require("fs");
const { createNodeStatusEmbed } = require("../utils/embeds");

module.exports = {
    updateNodeStatusEmbeds: async function (client, seconds) {
        const filePath = "./ptero/data/nodeStatusMessages.json";

        const updateEmbeds = async () => {
            // Ensure data directory exists
            if (!fs.existsSync("./ptero/data")) {
                fs.mkdirSync("./ptero/data", { recursive: true });
            }

            // Load JSON list
            let statusMessages = [];
            try {
                statusMessages = JSON.parse(fs.readFileSync(filePath, "utf8"));
            } catch {
                console.warn("Could not load existing node status messages, creating new file.");
                fs.writeFileSync(filePath, "[]");
                return;
            }

            if (statusMessages.length === 0) return;

            const tasks = statusMessages.map(async (msgInfo) => {
                const taskStart = Date.now();
                try {
                    const channel = await client.channels.fetch(msgInfo.channelId);
                    const message =
                        channel.messages.cache.get(msgInfo.messageId) ||
                        await channel.messages.fetch(msgInfo.messageId, { cache: true })
                            .catch(() => null);

                    if (!message) {
                        console.warn(`⚠️ Message for node ${msgInfo.nodeId} not found in channel ${msgInfo.channelId}. It may have been deleted.`);
                        statusMessages = statusMessages.filter(m => m.messageId !== msgInfo.messageId);
                        fs.writeFileSync(filePath, JSON.stringify(statusMessages, null, 4));
                        return;
                    }

                    const embed = await createNodeStatusEmbed(msgInfo.nodeId);
                    await message.edit({ embeds: [embed] });

                    await new Promise(res => setTimeout(res, 20));

                } catch (err) {
                    console.error(`Error updating node ${msgInfo.nodeId}:`, err);
                }

                return Date.now() - taskStart;
            });

            const results = await Promise.all(tasks);
            const validTimes = results.filter(ms => typeof ms === "number");
            const avgTime = validTimes.reduce((a, b) => a + b, 0) / validTimes.length;
            //console.log(`🕒 Updated ${validTimes.length} node embeds | Avg: ${avgTime.toFixed(1)} ms`);

        };

        // Run once immediately
        await updateEmbeds();
        console.log(`⌛ Watching node status embed(s) for updates every ${seconds} seconds...`);

        // Clear old interval if it exists
        if (this._nodeStatusInterval) clearInterval(this._nodeStatusInterval);

        // Run on interval
        this._nodeStatusInterval = setInterval(updateEmbeds, seconds * 1000);
    }
};
