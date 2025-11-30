
const { getHttpStatusIcon } = require("../../utils/httpStatusIcon");
const axios = require("axios");
const { pterodactyl } = require("../../config.json");

//vaidate the pterodactyl panel url by making a request to the api and checking the response
async function validatePanelUrl() {
    try {
        console.log(`🌐 Validating Pterodactyl panel URL: ${pterodactyl.domain}`);
        if (pterodactyl.domain.startsWith('http://')) { //always warn about this since its only on start up
            console.warn(`⚠️ Warning: You are using an unsecure HTTP connection for the Pterodactyl panel URL. This is not recommended for production environments. Please consider using HTTPS to secure your connection.\n(If you are running the panel on the same machine as the bot, you may ignore this warning.)`);
        }
        const response = await axios.get(`${pterodactyl.domain}`, {
            headers: {
                'Accept': 'Application/vnd.pterodactyl.v1+json',
                'Content-Type': 'application/json'
            },
            timeout: 5000 //5 second timeout
        });
        console.log(`🌐 Received response from Pterodactyl panel: ${getHttpStatusIcon(response.status)} ${response.status} ${response.statusText}`);
        if (response.status === 200) {
            return true;
        } else {
            return false;
        }
    } catch (error) {
        return false;
    }
}

module.exports = { validatePanelUrl };