const { Events } = require('discord.js');
const { readJson } = require('../utils/jsonStorage');
const { createServerEmbed } = require('../utils/embedBuilder');

module.exports = {
    name: Events.GuildMemberRemove,
    async execute(member) {
        const config = readJson('config.json', {});
        const guildConfig = config[member.guild.id] || {};

        if (guildConfig.leaveChannel) {
            const channel = member.guild.channels.cache.get(guildConfig.leaveChannel);
            if (channel) {
                const embed = createServerEmbed('warning', {
                    title: '👋 Goodbye',
                    description: guildConfig.leaveMessage
                        ? guildConfig.leaveMessage.replace('{user}', `**${member.user.tag}**`).replace('{server}', member.guild.name)
                        : `**${member.user.tag}** has left **${member.guild.name}**.`,
                    thumbnail: member.user.displayAvatarURL(),
                }, member.guild);
                try { await channel.send({ embeds: [embed] }); } catch {}
            }
        }
    },
};
