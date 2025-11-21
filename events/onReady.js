/**
 * @file Ready Event File.
 */

const { updateServerStatusEmbeds } = require("../ptero/utils/updateServerStatusEmbeds");
const { updateNodeStatusEmbeds } = require("../ptero/utils/updateNodeStatusEmbeds");
const { pterodactyl } = require("../config.json");
const { ActivityType } = require("discord.js");
const Nodeactyl = require("nodeactyl");
const { updatePresence } = require("../utils/updatePresence");

module.exports = {
	
    name: "ready",
    once: true,

    async execute(client) {
        console.log(`Ready! Logged in as ${client.user.tag}`);
        updateServerStatusEmbeds(client, pterodactyl.SERVER_STATUS_UPDATE_INTERVAL);
        updateNodeStatusEmbeds(client, pterodactyl.NODE_STATUS_UPDATE_INTERVAL);

        // Set initial status
        const pteroApp = new Nodeactyl.NodeactylApplication(
            pterodactyl.domain,
            pterodactyl.apiKey
        );
        const servers = await pteroApp.getAllServers();
        const totalServers = servers.data.length;
        client.user.setActivity(`${totalServers} servers on ${pterodactyl.company}`, {
            type: ActivityType.Watching
        });
        setInterval(async () => {
            updatePresence(client);
        }, 5 * 60 * 1000); // Update every 5 minutes
        console.log(`Status set: Watching ${totalServers} servers on ${pterodactyl.company}`);
    },

};
