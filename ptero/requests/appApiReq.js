const axios = require("axios");
const { pterodactyl } = require("../../config.json");

module.exports = { 
    async pteroAppReq(apiEndpoint, method = 'get', data = null) {
        try {
            const url = `${pterodactyl.domain}/api/application/${apiEndpoint}`;
            const headers = {
                'Authorization': `Bearer ${pterodactyl.apiKey}`,
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
                console.error(`Error making Pterodactyl API request to ${apiEndpoint}:`, await this.getPteroApplicationError(error));
            }
            throw error;
        }
    },
    async getPteroApplicationError(error) {
        let message = "An unknown error occurred.";
        switch (true) {
            case error.response && error.response.status === 400:
                message = "Bad Request: The server could not understand the request due to invalid syntax.";
                break;
            case error.response && error.response.status === 401:
                message = "Unauthorized: Your client API key is invalid. Please check your Client API Key in the config.json file.";
                break;
            case error.response && error.response.status === 403:
                message = "Forbidden: Your client API key does not have permission to access this resource. Please check the permissions for your Client API Key in the Pterodactyl admin panel.";
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