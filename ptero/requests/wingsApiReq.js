const axios = require('axios');
const { pterodactyl } = require('../../config.json');

module.exports = {
    async wingsApiReq(nodeDetails, nodeToken, apiEndpoint, method = 'get', data = null) {
        try {
            const url = `https://${nodeDetails.fqdn}:${nodeDetails.daemon_listen}/api/${apiEndpoint}`;
            console.log(`Making Wings API request to ${url} on node ${nodeDetails.name}`);
            const headers = {
                'Authorization': `Bearer ${nodeToken}`,
                'Accept': '*/*',
                'Content-Type': 'application/json'
            };  
            const options = {
                method: method,
                url: url,
                headers: headers,
                data: data
            };
            const response = await axios(options);
            return response.data;
        } catch (error) {
            console.error(`Error making Wings API request to ${apiEndpoint} on node ${nodeDetails.name}:`, error.response ? error.response.data : error.message);
            throw error;
        }
    }
};