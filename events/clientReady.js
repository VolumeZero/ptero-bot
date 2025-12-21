/**
 * @file Ready Event File.
 */

const { updateServerStatusEmbeds } = require("../ptero/utils/updateServerStatusEmbeds");
const { updateNodeStatusEmbeds } = require("../ptero/utils/updateNodeStatusEmbeds");
const { pterodactyl } = require("../config.json");
const { updatePresence } = require("../utils/updatePresence");
const { isApplicationKeyValid } = require("../ptero/utils/serverUtils");
const { validatePanelUrl } = require("../ptero/utils/validatePanelUrl");

module.exports = {
    
    name: "clientReady",
    once: true,

    async execute(client) {

        try {
            console.log(`🐦 Initiating Ptero-Bot v${client.version}...`);
            const isPanelUrlValid = await validatePanelUrl();
            if (!isPanelUrlValid) {
                console.error(`❌ The Pterodactyl panel URL (${pterodactyl.domain}) is invalid. Please check the URL in the config.json file and ensure the panel is online and reachable from the internet.`);
                console.log(`🚪 Exiting Ptero-Bot...`);
                process.exit(1);
            }


            const appKeyVaild = await isApplicationKeyValid();
            if (appKeyVaild) {
                console.log(`✅ Sucessfully authenticated with the Pterodactyl application API for ${pterodactyl.domain}`);
                updateNodeStatusEmbeds(client, pterodactyl.NODE_STATUS_UPDATE_INTERVAL);
            } else {
                console.warn("⚠️ The Pterodactyl application API key is invalid. Node status embeds will not be updated. Some other features also may not work...");
            }
            
            updateServerStatusEmbeds(client, pterodactyl.SERVER_STATUS_UPDATE_INTERVAL);

            const gitHubUrl = "https://github.com/VolumeZero/ptero-bot";
            console.log(`🔗 Report any issues on: ${gitHubUrl}`);

            console.log(`✅ Ready and logged in as ${client.user.tag}`);
            updatePresence(client); 
            setInterval(() => updatePresence(client), 10 * 60 * 1000); // Update presence every 15 minutes
        } catch (error) {
            console.error("Error in clientReady event:", error);
        }
    },

};
