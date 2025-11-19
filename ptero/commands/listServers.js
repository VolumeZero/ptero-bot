    
    
    
const { EmbedBuilder } = require('discord.js');
const { pterodactyl } = require("../../config.json");
const  Nodeactyl  = require('nodeactyl');


async function listServers(interaction, clientApiKey) {
    try {
		const pteroClient = new Nodeactyl.NodeactylClient(pterodactyl.domain, clientApiKey);
		const servers = await pteroClient.getAllServers();
    	if (servers.length === 0) {
    		return interaction.reply({
    			content: "You have no servers associated with your account.",
    			ephemeral: true,
    		});
    	} else {
    		//sort the servers by name
    		servers.data.sort((a, b) => {
    			if (a.attributes.name.toLowerCase() < b.attributes.name.toLowerCase()) return -1;
    			if (a.attributes.name.toLowerCase() > b.attributes.name.toLowerCase()) return 1;
    			return 0;
    		});
    		const embed = new EmbedBuilder()
    			.setTitle('Your Servers')
    			.setColor(0x00AE86) // nice teal color
    			.setDescription(
    			    servers.data
    			        .map(s => `[**${s.attributes.name}**](${pterodactyl.domain}/server/${s.attributes.identifier}) (ID: ${s.attributes.identifier})`)
    			        .join("\n")
    			)
    			.setTimestamp()
    			.setFooter({ text: 'Pterodactyl Bot' });
            
    		await interaction.reply({ embeds: [embed], flags: 64 }); // ephemeral
    	}
    } catch (error) {
    	console.error("Error fetching servers:", error);
    	let message = "There was an error fetching your servers.";
    	if (error?.response?.status) {
    	    switch (error.response.status) {
    	        case 401:
    	            message += " Your API key is invalid.";
    	            break;
    	        case 403:
    	            message += " Your API key does not have permission to access the API.";
    	            break;
    	        case 404:
    	            message += " The requested resource was not found.";
    	            break;
    	        default:
    	            message += ` HTTP status code: ${error.response.status}`;
    	    }
    	} else if (error?.code) {
    	    message += ` Error code: ${error.code}`;
    	} else if (error?.message) {
    	    message += ` ${error.message}`;
    	}

    	return interaction.reply({
    	    content: message,
    	    flags: 64, // ephemeral
    	});
    }
}
module.exports = { listServers };