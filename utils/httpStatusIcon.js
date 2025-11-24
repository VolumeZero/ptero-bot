module.exports = {
    getHttpStatusIcon: function (statusCode) {
        let icon = "❓"; // Default icon for unknown status codes
        if (statusCode >= 200 && statusCode < 300) {
            icon = "🟢"; // Success
        } else if (statusCode >= 300 && statusCode < 400) {
            icon = "➡️"; // Redirection
        } else if (statusCode >= 400 && statusCode < 500) {
            icon = "🟡"; // Client Error
        } else if (statusCode >= 500 && statusCode < 600) {
            icon = "🔴"; // Server Error
        }
        return icon;
    }
};