function getAppErrorMessage(errorStatus) {
    let message = "An unknown error occurred.";
    switch (true) {
        case errorStatus === 400:
            message = "Bad Request: The server could not understand the request due to invalid syntax.";
            break;
        case errorStatus === 401:
            message = "Unauthorized: Your API key is invalid. Please check your Application API key in the config.json file.";
            break;
        case errorStatus === 403:
            message = "Forbidden: Your API key does not have permission to access this resource. Please check the permissions for your Application API key in the Pterodactyl admin panel.";
            break;
        case errorStatus === 404:
            message = "Not Found: The requested resource was not found.";
            break;
        case errorStatus === 500:
            message = "Internal Server Error: The server has encountered a situation it doesn't know how to handle. Please report this to the server administrator.";
            break;
        case errorStatus === 502:
            message = "Bad Gateway: The server was acting as a gateway or proxy and received an invalid response from the upstream server.";
            break;
        case errorStatus === 503:
            message = "Service Unavailable: The server is not ready to handle the request.";
            break;
        case errorStatus === 504:
            message = "Gateway Timeout: The server was acting as a gateway or proxy and did not receive a timely response from the upstream server. (This may indicate that the Pterodactyl panel or wings node is down or unreachable.)";
            break;
        case errorStatus === 'ECONNREFUSED':
            message = "Connection Refused: Unable to connect to the Pterodactyl panel. Please ensure the panel is running and the domain is correct in the config.json file.";
            break;
        case errorStatus === 'ENOTFOUND':
            message = "Domain Not Found: The specified domain for the Pterodactyl panel could not be found. Please check the domain in the config.json file.";
            break;
        case typeof errorStatus.code === 'string' && errorStatus.code.includes('ETIMEDOUT'):
            message = "Connection Timed Out: The request to the Pterodactyl panel or wings node timed out. Please check the network connection and ensure the panel is reachable.";
            break;
        default:
            message = `Unexpected Error: ${errorStatus}. Please make sure your Pterodactyl panel is reachable and that the API key and domain are correct in the config.json file.`;
    }
    return message;
}

module.exports = { getAppErrorMessage };
