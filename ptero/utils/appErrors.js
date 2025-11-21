
function getAppErrorMessage(errorStatus) {
    let message = "An unknown error occurred.";
    switch (errorStatus) {
        case 400:
            message = "Bad Request: The server could not understand the request due to invalid syntax.";
            break;
        case 401:
            message = "Unauthorized: Your API key is invalid. Please check your Application API key in the config.json file.";
            break;
        case 403:
            message = "Forbidden: Your API key does not have permission to access this resource. Please check the permissions for your Application API key in the Pterodactyl admin panel.";
            break;
        case 404:
            message = "Not Found: The requested resource was not found.";
            break;
        case 500:
            message = "Internal Server Error: The server has encountered a situation it doesn't know how to handle. Please report this to the server administrator.";
            break;
        case 502:
            message = "Bad Gateway: The server was acting as a gateway or proxy and received an invalid response from the upstream server.";
            break;
        case 503:
            message = "Service Unavailable: The server is not ready to handle the request.";
            break;
        case 504:
            message = "Gateway Timeout: The server was acting as a gateway or proxy and did not receive a timely response from the upstream server.";
            break;
        default:
            message = `Unexpected Error: HTTP status code ${errorStatus}. Please make sure your Pterodactyl panel is reachable and that the API key and domain are correct in the config.json file.`;
    }
    return message;
}

module.exports = { getAppErrorMessage };