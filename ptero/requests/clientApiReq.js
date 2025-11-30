const axios = require('axios');
const { pterodactyl } = require("../../config.json");

const PteroClient = { 
    async request(apiEndpoint, clientApiKey, method = 'get', data = null) {
        try {
            const url = `${pterodactyl.domain}/api/client/${apiEndpoint}`;
            const headers = { 
                'Authorization': `Bearer ${clientApiKey}`,
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
            if (pterodactyl.ERROR_LOGGING_ENABLED) {
                console.error(`Error making Pterodactyl API request to client/${apiEndpoint}:`, this.getErrorMessage(error) || error);
            }
            throw error;
        }
    },

    async sendPowerSignal(serverId, clientApiKey, signal) {
        try {
            const url = `${pterodactyl.domain}/api/client/servers/${serverId}/power`;
            const headers = {
                'Authorization': `Bearer ${clientApiKey}`,
                'Accept': 'Application/vnd.pterodactyl.v1+json',
                'Content-Type': 'application/json'
            };
            const options = {
                method: 'post', 
                url: url,
                headers: headers,
                data: { signal: signal }
            };
            const response = await axios(options);
            return response.data;
        } catch (error) {
            if (pterodactyl.ERROR_LOGGING_ENABLED) {
                console.error(`Error sending power signal to server ${serverId}:`, error);
            }
            throw error;
        }
    },

    getErrorMessage(error) {
        let message = "An unknown error occurred while making a client API request.";
        switch (true) {
            case error.response && error.response.status === 400:
                message = "Bad Request: The server could not understand the request due to invalid syntax.";
                break;
            case error.response && error.response.status === 401:
                message = "Unauthorized: Your client API key is invalid. Please check your Client API Key in the config.json file.";
                break;
            case error.response && error.response.status === 403:
                message = "Forbidden: Your client API key does not have permission to access this resource.";
                break;
            case error.response && error.response.status === 404:
                message = "Not Found: The requested resource was not found.";
                break;
            case error.response && error.response.status === 500:
                message = "Internal Server Error: The server has encountered a situation it doesn't know how to handle. Please report this to the server administrator.";
                break;
            case error.response && error.response.status === 502:
                message = "Bad Gateway: The server was acting as a gateway or proxy and received an invalid response from the upstream server.";
                break;
            case error.response && error.response.status === 503:   
                message = "Service Unavailable: The server is not ready to handle the request.";
                break;
            case error.response && error.response.status === 504:
                message = "Gateway Timeout: The server was acting as a gateway or proxy and did not receive a timely response from the upstream server. (This may indicate that the Pterodactyl panel is down or unreachable.)";
                break;
            case error.code === 'ECONNREFUSED':
                message = "Connection Refused: Unable to connect to the Pterodactyl panel. Please ensure the panel is online and reachable.";
                break;
            case error.code === 'ETIMEDOUT':
                message = "Connection Timed Out: The request to the Pterodactyl panel timed out or the panel is offline. Please check the network connection and try again.";
                break;
        }
        return message;
    }

}

module.exports = { PteroClient };


