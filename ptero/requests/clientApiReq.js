const axios = require('axios');
const { pterodactyl } = require("../../config.json");

async function pteroClientReq(apiEndpoint, apiKey) {
    try {
        const response = await axios.get(`${pterodactyl.domain}/api/client/${apiEndpoint}`, {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Accept': 'Application/vnd.pterodactyl.v1+json',
                'Content-Type': 'application/json'
            }
        });
        return response.data;
    } catch (error) {
        if (pterodactyl.ERROR_LOGGING_ENABLED) {
            console.error(`Error making client request to \'/api/client/${apiEndpoint}\':`, error.response ? error.response.data : error.message);
        }
        throw error;
    }
}

module.exports = { pteroClientReq };


