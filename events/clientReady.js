/**
 * @file Ready Event File.
 */

const { updateServerStatusEmbeds } = require("../ptero/utils/updateServerStatusEmbeds");
const { updateNodeStatusEmbeds } = require("../ptero/utils/updateNodeStatusEmbeds");
const { pterodactyl } = require("../config.json");
const { updatePresence } = require("../utils/updatePresence");
const { isApplicationKeyValid } = require("../ptero/utils/serverUtils");
const Nodeactyl = require("nodeactyl");

module.exports = {
    
    name: "clientReady",
    once: true,

    async execute(client) {

        try {
            updateServerStatusEmbeds(client, pterodactyl.SERVER_STATUS_UPDATE_INTERVAL);

            const appKeyVaild = await isApplicationKeyValid();
            if (appKeyVaild) {
                updateNodeStatusEmbeds(client, pterodactyl.NODE_STATUS_UPDATE_INTERVAL);
                console.log(`✅ Sucessfully authenticated with the pterodactyl application API for ${pterodactyl.company}.`);
                client.pteroApp = new Nodeactyl.NodeactylApplication(pterodactyl.domain, pterodactyl.apiKey);
            } else {
                console.warn("⚠️ The pterodactyl API key is invalid. Node status embeds will not be updated. Server status logs will also not function.");
            }
            updatePresence(client); 
            setInterval(() => updatePresence(client), 10 * 60 * 1000); // Update presence every 15 minutes

            console.log(`✅ Ready and logged in as ${client.user.tag}`);
        } catch (error) {
            console.error("Error in clientReady event:", error);
        }
    },

};
