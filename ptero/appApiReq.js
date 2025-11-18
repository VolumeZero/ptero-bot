const axios = require("axios");
const { pterodactyl } = require("../config.json");

async function pteroAppReq(apiEndpoint, params) {
    try {
        const response = await axios.get(`${pterodactyl.domain}/api/application/${apiEndpoint}`, {
            headers: {
                'Authorization': `Bearer ${pterodactyl.apiKey}`,
                'Accept': 'Application/vnd.pterodactyl.v1+json',
                'Content-Type': 'application/json'
            },
            params: params

        });
        return response.data;
    } catch (error) {
        console.error(`Error making application request to ${apiEndpoint}:`, error.response ? error.response.data : error.message);
        throw error;
    }
}

module.exports = { pteroAppReq };