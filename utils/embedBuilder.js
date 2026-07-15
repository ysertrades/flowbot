const { EmbedBuilder } = require('discord.js');

const colors = {
    success: 0x57F287,
    error: 0xED4245,
    info: 0x5865F2,
    warning: 0xFEE75C,
    giveaway: 0xF47FFF,
    ticket: 0x00D4AA,
    userinfo: 0x9B59B6,
    shop: 0xF39C12,
    inventory: 0x3498DB,
};

function parseColor(colorInput) {
    if (!colorInput) return null;
    if (colorInput.startsWith('#')) {
        const parsed = parseInt(colorInput.slice(1), 16);
        return isNaN(parsed) ? null : parsed;
    }
    const parsed = parseInt(colorInput, 16);
    if (!isNaN(parsed) && parsed >= 0 && parsed <= 0xFFFFFF) return parsed;
    return null;
}

function createEmbed(type, options = {}) {
    const embed = new EmbedBuilder()
        .setColor(options.color || colors[type] || colors.info)
        .setTimestamp();

    if (options.title) embed.setTitle(options.title);
    if (options.description) embed.setDescription(options.description);
    if (options.footer) embed.setFooter({ text: options.footer, iconURL: options.footerIcon });
    if (options.thumbnail) embed.setThumbnail(options.thumbnail);
    if (options.image) embed.setImage(options.image);
    if (options.author) embed.setAuthor({ name: options.author.name, iconURL: options.author.iconURL });
    if (options.fields) {
        for (const field of options.fields) {
            embed.addFields({
                name: field.name,
                value: field.value,
                inline: field.inline || false,
            });
        }
    }
    return embed;
}

function createServerEmbed(type, options = {}, guild) {
    const footerText = options.footer || `${guild?.name || 'Server'} • YSER Flow`;
    return createEmbed(type, { ...options, footer: footerText });
}

module.exports = { createEmbed, createServerEmbed, colors, parseColor };
