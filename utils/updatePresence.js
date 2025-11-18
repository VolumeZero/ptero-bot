const { ActivityType } = require("discord.js");
const Nodeactyl = require("nodeactyl");
const { pterodactyl } = require("../config.json");

async function updatePresence(client) {
    const pteroApp = new Nodeactyl.NodeactylApplication(
        pterodactyl.domain,
        pterodactyl.apiKey
    );
    const servers = await pteroApp.getAllServers();
    const totalServers = servers.data.length;
    await client.user.setActivity(`${totalServers} servers on ${pterodactyl.company}`, {
        type: ActivityType.Watching
    });
}

module.exports = {
    updatePresence,
};