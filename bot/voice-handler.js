'use strict';

const VOICE_CHANNEL_ID = process.env.VOICE_CHANNEL_ID;

async function joinVoiceChannel(client) {
  if (!VOICE_CHANNEL_ID) return;

  let channel;
  try {
    channel = await client.channels.fetch(VOICE_CHANNEL_ID);
    if (!channel?.isVoice()) {
      console.warn(`[WARN] Voice channel dengan ID ${VOICE_CHANNEL_ID} tidak ditemukan atau bukan saluran suara.`);
      return;
    }
    await client.voice.joinChannel(channel, { selfMute: true });
    console.log(`[INFO] Berhasil bergabung ke voice channel: ${channel.name} (Muted)`);
  } catch (error) {
    if (channel && error.message.includes('Connection not established within 15 seconds')) {
      console.log(`[INFO] Berhasil bergabung ke voice channel: ${channel.name} (Muted), meskipun ada peringatan timeout.`);
    } else {
      console.error(`[ERROR] Gagal bergabung ke voice channel: ${error.message}`);
    }
  }
}

function setupVoiceChannel(client) {
  joinVoiceChannel(client);

  client.on('voiceStateUpdate', (oldState, newState) => {
    if (oldState.member.id === client.user.id && oldState.channelId && !newState.channelId) {
      console.log('[WARN] Koneksi voice channel terputus. Mencoba untuk bergabung kembali...');
      setTimeout(() => joinVoiceChannel(client), 5000);
    }
  });
}

module.exports = { setupVoiceChannel };