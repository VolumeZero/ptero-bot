const fs = require("fs");
const { createNodeStatusEmbed } = require("../utils/embeds");

module.exports = {
    updateNodeStatusEmbeds: async function (client, seconds) {
        let numOfEmbeds = 0;
        const filePath = "./ptero/data/nodeStatusMessages.json";

        const updateEmbeds = async () => {
            const start = Date.now();

            // Ensure data directory exists
            if (!fs.existsSync("./ptero/data")) {
                fs.mkdirSync("./ptero/data", { recursive: true });
            }

            // Load node messages from JSON
            let statusMessages = [];
            try {
                statusMessages = JSON.parse(fs.readFileSync(filePath));
            } catch {
                console.warn("Could not load existing node status messages, creating new file.");
                fs.writeFileSync(filePath, "[]");
            }

            // Create all update tasks
            const tasks = statusMessages.map(async (msgInfo) => {
                try {
                    const channel = await client.channels.fetch(msgInfo.channelId);
                    const message = await channel.messages.fetch(msgInfo.messageId).catch(() => null);

                    if (!message) {
                        // Remove missing messages
                        statusMessages = statusMessages.filter(m => m !== msgInfo);
                        fs.writeFileSync(filePath, JSON.stringify(statusMessages, null, 4));
                        return;
                    }

                    const embed = await createNodeStatusEmbed(msgInfo.nodeId);
                    await message.edit({ embeds: [embed] });
                    numOfEmbeds++;

                    // Optional small delay to avoid Discord rate limits
                    await new Promise(resolve => setTimeout(resolve, 20));

                } catch (err) {
                    console.error(`Error updating node ${msgInfo.nodeId}:`, err);
                }
            });

            // Run all updates in parallel
            await Promise.all(tasks);

            //console.log(`🕒 Updated ${numOfEmbeds} node status embed(s) in ${Date.now() - start} ms.`);
            numOfEmbeds = 0;
        };

        // Run once immediately
        updateEmbeds();
        console.log(`⌛ Watching node status embed(s) for updates every ${seconds} seconds...`);
        // Then continue at the interval
        setInterval(updateEmbeds, seconds * 1000);
    }
};
