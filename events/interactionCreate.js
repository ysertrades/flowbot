// events/interactionCreate.js
const { InteractionType } = require('discord.js');
const embedUtil = require('../utils/embed');

module.exports = {
  name: 'interactionCreate',
  async execute(interaction, client) {
    // ── Slash Commands ───────────────────────────────────
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command) return;

      try {
        await command.execute(interaction, client);
      } catch (err) {
        console.error(`[CMD ERROR] /${interaction.commandName}:`, err);
        const errEmbed = embedUtil.error('Error', 'An unexpected error occurred. Please try again.');
        const reply = { embeds: [errEmbed], ephemeral: true };
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp(reply).catch(() => {});
        } else {
          await interaction.reply(reply).catch(() => {});
        }
      }
    }

    // ── Button Interactions ──────────────────────────────
    if (interaction.isButton()) {
      // Check for giveaway button specifically
      if (interaction.customId === 'giveaway_enter') {
        if (!global.giveawayEntrants) global.giveawayEntrants = new Map();
        const entrants = global.giveawayEntrants.get(interaction.message.id);
        
        if (!entrants) {
          return interaction.reply({ content: 'This giveaway has ended or was not found.', ephemeral: true });
        }
        
        if (entrants.has(interaction.user.id)) {
          return interaction.reply({ content: 'You\'ve already entered this giveaway!', ephemeral: true });
        }
        
        entrants.add(interaction.user.id);
        return interaction.reply({ content: 'You\'ve entered the giveaway! Good luck! 🎉', ephemeral: true });
      }

      const [system, ...args] = interaction.customId.split(':');

      const handler = client.commands.get(`btn_${system}`);
      if (handler?.handleButton) {
        try {
          await handler.handleButton(interaction, args, client);
        } catch (err) {
          console.error(`[BTN ERROR] ${interaction.customId}:`, err);
          const errEmbed = embedUtil.error('Error', 'An unexpected error occurred.');
          if (interaction.replied || interaction.deferred) {
            await interaction.followUp({ embeds: [errEmbed], ephemeral: true }).catch(() => {});
          } else {
            await interaction.reply({ embeds: [errEmbed], ephemeral: true }).catch(() => {});
          }
        }
      }
    }

    // ── Select Menu Interactions ─────────────────────────
    if (interaction.isStringSelectMenu()) {
      const [system, ...args] = interaction.customId.split(':');
      const handler = client.commands.get(`sel_${system}`);
      if (handler?.handleSelect) {
        try {
          await handler.handleSelect(interaction, args, client);
        } catch (err) {
          console.error(`[SEL ERROR] ${interaction.customId}:`, err);
          const errEmbed = embedUtil.error('Error', 'An unexpected error occurred.');
          if (interaction.replied || interaction.deferred) {
            await interaction.followUp({ embeds: [errEmbed], ephemeral: true }).catch(() => {});
          } else {
            await interaction.reply({ embeds: [errEmbed], ephemeral: true }).catch(() => {});
          }
        }
      }
    }
  },
};
