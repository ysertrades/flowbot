const { Events } = require('discord.js');
const { readJson } = require('../utils/jsonStorage');
const { createServerEmbed } = require('../utils/embedBuilder');

module.exports = {
    name: Events.GuildMemberAdd,
    async execute(member) {
        const config = readJson('config.json', {});
        const guildConfig = config[member.guild.id] || {};

        if (guildConfig.autoRole) {
            const role = member.guild.roles.cache.get(guildConfig.autoRole);
            if (role) {
                try { await member.roles.add(role); } catch {}
            }
        }

        if (guildConfig.welcomeChannel) {
            const channel = member.guild.channels.cache.get(guildConfig.welcomeChannel);
            if (channel) {
                const embed = createServerEmbed('info', {
                    title: '👋 Welcome!',
                    description: guildConfig.welcomeMessage
                        ? guildConfig.welcomeMessage.replace('{user}', `<@${member.id}>`).replace('{server}', member.guild.name)
                        : `Welcome to **${member.guild.name}**, <@${member.id}>!`,
                    thumbnail: member.user.displayAvatarURL(),
                }, member.guild);
                try { await channel.send({ embeds: [embed] }); } catch {}
            }
        }
    },
};
