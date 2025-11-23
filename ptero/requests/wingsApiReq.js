const axios = require('axios');
const { pterodactyl } = require('../../config.json');

module.exports = {
    async wingsApiReq(nodeDetails, nodeToken, apiEndpoint, method = 'get', data = null) {
        try {
            const url = `${nodeDetails.scheme}://${nodeDetails.fqdn}:${nodeDetails.daemon_listen}/api/${apiEndpoint}`;
            const headers = {
                'Authorization': `Bearer ${nodeToken}`,
                'Accept': 'Application/vnd.pterodactyl.v1+json',
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