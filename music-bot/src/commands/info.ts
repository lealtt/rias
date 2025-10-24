import { Message, EmbedBuilder } from 'discord.js';
import { Rias, formatBytes, formatTime, percentage } from '@lealt/rias';
import { Command } from '../types';

const command: Command = {
  name: 'info',
  description: 'Show Lavalink server and plugin information',
  aliases: ['serverinfo', 'plugins'],
  usage: '!info',
  async execute(message: Message, _args: string[], rias: Rias): Promise<void> {
    try {
      const embed = new EmbedBuilder()
        .setTitle('Lavalink Server Information')
        .setColor('#0099ff')
        .setTimestamp();

      // Get server info from all nodes
      const serverInfoMap = await rias.getInfo();
      const pluginsMap = await rias.getAllPlugins();
      const stats = rias.getStats();

      if (serverInfoMap.size === 0) {
        await message.reply('No Lavalink nodes are currently connected!');
        return;
      }

      // Add info for each node
      for (const [nodeId, info] of serverInfoMap) {
        const nodeStats = stats.get(nodeId);
        const plugins = pluginsMap.get(nodeId);

        let nodeInfo = `**Version:** ${info.version.semver}\n`;
        nodeInfo += `**Build:** ${info.buildTime ? new Date(info.buildTime).toLocaleDateString() : 'Unknown'}\n`;

        if (nodeStats) {
          nodeInfo += `**Players:** ${nodeStats.playingPlayers}/${nodeStats.players}\n`;
          nodeInfo += `**CPU:** ${percentage(nodeStats.cpu.lavalinkLoad, 1)}%\n`;
          nodeInfo += `**Memory:** ${formatBytes(nodeStats.memory.used)} / ${formatBytes(nodeStats.memory.reservable)}\n`;
          nodeInfo += `**Uptime:** ${formatTime(nodeStats.uptime)}\n`;
        }

        if (plugins && plugins.length > 0) {
          nodeInfo += `**Plugins:** ${plugins.map(p => `${p.name} v${p.version}`).join(', ')}`;
        } else {
          nodeInfo += '**Plugins:** None';
        }

        embed.addFields({
          name: `Node: ${nodeId}`,
          value: nodeInfo
        });
      }

      // Add source managers info from the first node
      const firstInfo = Array.from(serverInfoMap.values())[0];
      if (firstInfo.sourceManagers.length > 0) {
        embed.addFields({
          name: 'Source Managers',
          value: firstInfo.sourceManagers.join(', ')
        });
      }

      await message.reply({ embeds: [embed] });
    } catch (error) {
      console.error(error);
      await message.reply('An error occurred while fetching server information!');
    }
  }
};

export default command;
