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
      const [system, ...args] = interaction.customId.split(':');

      const handler = client.commands.get(`btn_${system}`);
      if (handler?.handleButton) {
        try {
          await handler.handleButton(interaction, args, client);
        } catch (err) {
          console.error(`[BTN ERROR] ${interaction.customId}:`, err);
        }
      }
    }

    // ── Select Menu Interactions ─────────────────────────
    if (interaction.isStringSelectMenu()) {
      const [system] = interaction.customId.split(':');
      const handler = client.commands.get(`sel_${system}`);
      if (handler?.handleSelect) {
        try {
          await handler.handleSelect(interaction, client);
        } catch (err) {
          console.error(`[SEL ERROR] ${interaction.customId}:`, err);
        }
      }
    }
  },
};
