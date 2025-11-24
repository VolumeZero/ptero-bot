/**
 * @file Ready Event File.
 */

const { updateServerStatusEmbeds } = require("../ptero/utils/updateServerStatusEmbeds");
const { updateNodeStatusEmbeds } = require("../ptero/utils/updateNodeStatusEmbeds");
const { pterodactyl } = require("../config.json");
const { updatePresence } = require("../utils/updatePresence");
const { isApplicationKeyValid } = require("../ptero/utils/serverUtils");
const { validatePanelUrl } = require("../ptero/utils/validatePanelUrl");
const Nodeactyl = require("nodeactyl");

module.exports = {
    
    name: "clientReady",
    once: true,

    async execute(client) {

        try {
            console.log(`🐦 Initiating Ptero-Bot...`);
            const isPanelUrlValid = await validatePanelUrl();
            if (!isPanelUrlValid) {
                console.error(`❌ The Pterodactyl panel URL (${pterodactyl.domain}) is invalid. Please check the URL in the config.json file and ensure the panel is online and reachable from the internet.`);
                console.log(`🚪 Exiting Ptero-Bot...`);
                process.exit(1);
            }

            updateServerStatusEmbeds(client, pterodactyl.SERVER_STATUS_UPDATE_INTERVAL);

            const appKeyVaild = await isApplicationKeyValid();
            if (appKeyVaild) {
                updateNodeStatusEmbeds(client, pterodactyl.NODE_STATUS_UPDATE_INTERVAL);
                console.log(`✅ Sucessfully authenticated with the pterodactyl application API for ${pterodactyl.domain}.`);
                client.pteroApp = new Nodeactyl.NodeactylApplication(pterodactyl.domain, pterodactyl.apiKey);
            } else {
                console.warn("⚠️ The pterodactyl API key is invalid. Node status embeds will not be updated. Server status logs will also not function.");
            }

            console.log(`✅ Ready and logged in as ${client.user.tag}`);
            const gitHubUrl = "https://github.com/VolumeZero/ptero-bot";
            console.log(`🔗 Report any issues on: ${gitHubUrl}`);

            updatePresence(client); 
            setInterval(() => updatePresence(client), 10 * 60 * 1000); // Update presence every 15 minutes
        } catch (error) {
            console.error("Error in clientReady event:", error);
        }
    },

};
