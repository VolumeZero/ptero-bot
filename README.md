<h1 align="center">Welcome to Ptero-Bot 👋</h1>
<p align="center"> <img alt="Version" src="https://img.shields.io/badge/version-v1.0-blue.svg" /> <img alt="Documentation" src="https://img.shields.io/badge/documentation-WIP-brightgreen.svg" /> <img alt="Maintenance" src="https://img.shields.io/badge/maintained-yes-green.svg" /> </p>

A Discord bot built for managing, monitoring, and interacting with Pterodactyl servers — all directly from Discord.

🏠 Introduction

Ptero-Bot is a powerful, lightweight Node.js Discord bot built for Pterodactyl panel users.
Using the Nodeactyl API, Ptero-Bot allows server owners and users to manage their Pterodactyl servers directly from Discord.

It provides real-time server monitoring, detailed embeds, and an interactive server manager UI inside Discord.

Even if you are not the owner of the Pterodactyl panel, you can still use user-specific API keys to manage your own servers through the bot. (Status embeds will not work without an application API key. Server status will eventually be supported)


✨ Core Features
• Interactive Server Manager

The bot includes a complete server management interface using Discord buttons:

Start / Stop / Restart server

View live console logs

View live resource usage (CPU, RAM, Disk)

View server details (IP, allocations, node, location, etc.)

View SFTP details (username, password, port)

WebSocket-powered updates to avoid any rate limits

Disable old sessions automatically when user starts a new one or after 60 seconds of inactivity

![Main Server Manager](.images/server-manager.png)



• Server Status Embeds

Compact and detailed server info

Power state icons

CPU, RAM, storage, and uptime

Api powered updates

![Server Status Embed](.images/status-embed.png)


• Node Status Embeds

Resource usage

Allocation data

Node name, location, networking

![Server Status Embed](.images/node-embed.png)


Extra Features ✅

• Autocomplete, Modals & Interaction-Ready

Full support for:

Slash commands

Autocomplete (server listings, IDs, etc.)

Button interactions


• Flexible API Key System

Supports:

Global API key in config for non-user-specific actions (application api)

User-specific API keys for personalized server management per user (client api)

Automatic prompting when missing


🔧 Installation
npm install/yarn install


⚙️ Configuration

Rename config-example.json to config.json and fill in all the required fields

Setup a Discord bot and get the bot token from the Discord Developer Portal: https://discord.com/developers/applications
Fill in the required fields in config

▶️ Run the Bot

npm start

Once the bot is invited to your server, use the '/pt key' command to link your Pterodactyl API key to your Discord user account. From there, you can manage your own servers using the bot with '/pt manage'.

📋 Config Notes

panelUrl must end with no trailing slash

guildId is only required for local development slash-command registration

📚 Documentation

Offical documentation is not yet available. Please refer to the source code and this readme for guidance.

👤 Author

VolumeZero

🤝 Contributing

PRs and suggestions are welcome!
Issues can be opened any time.

⭐ Show Your Support

If this bot helped you, consider starring the repo!

📝 License

This project is licensed under the MIT License - see the LICENSE file for details.