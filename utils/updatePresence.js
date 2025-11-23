const { ActivityType } = require("discord.js");
const Nodeactyl = require("nodeactyl");
const { pterodactyl } = require("../config.json");
const { getAppErrorMessage } = require("../ptero/utils/appErrors");
const { isApplicationKeyValid } = require("../ptero/utils/serverUtils");
const fs = require("fs");

async function updatePresence(client) {

    try {
        const appKeyVaild = await isApplicationKeyValid(pterodactyl.apiKey);
        if (appKeyVaild) {
            const pteroApp = new Nodeactyl.NodeactylApplication(
                pterodactyl.domain,
                pterodactyl.apiKey
            );
            const servers = await pteroApp.getAllServers();
            const totalServers = servers.data.length || `0`;
            await client.user.setActivity(`${totalServers} servers on ${pterodactyl.company}`, {
                type: ActivityType.Watching
            });
            //console.log(`Updated presence to watch ${totalServers} servers on ${pterodactyl.company}.`);
        } else {
            let totalEmbeds = 0;
            //read embed.json files to count total server status embeds
            const dataDir = "./ptero/data";
            if (fs.existsSync(dataDir)) {
                const files = fs.readdirSync(dataDir);
                for (const file of files) {
                    if (file.startsWith("statusMessages") && file.endsWith(".json")) {
                        const statusMessages = JSON.parse(fs.readFileSync(`${dataDir}/${file}`));
                        totalEmbeds += statusMessages.length;
                    } else if (file.startsWith("nodeStatusMessages") && file.endsWith(".json")) {
                        const nodeStatusMessages = JSON.parse(fs.readFileSync(`${dataDir}/${file}`));
                        totalEmbeds += nodeStatusMessages.length;
                    }
                }
            }
            client.user.setActivity(`${totalEmbeds} servers on ${pterodactyl.company}`, {
                type: ActivityType.Watching
            });
            //console.log(`Set presence to watch ${totalEmbeds} servers on ${pterodactyl.company}.`);
        }

        setInterval(async () => {
            await updatePresence(client);
        }, 5 * 60 * 1000); // Update every 5 minutes
    } catch (error) {
        console.error("Error updating presence:", getAppErrorMessage(error));
    }

}

module.exports = {
    updatePresence,
};