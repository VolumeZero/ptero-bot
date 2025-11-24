
const { getHttpStatusIcon } = require("../../utils/httpStatusIcon");

//vaidate the pterodactyl panel url by making a request to the api and checking the response
async function validatePanelUrl() {
    const axios = require("axios");
    const { pterodactyl } = require("../../config.json");
    try {
        console.log(`🌐 Validating Pterodactyl panel URL: ${pterodactyl.domain}`);
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