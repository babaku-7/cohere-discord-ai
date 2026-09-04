'use strict';
require('dotenv').config();

const { setTimeout: sleep } = require('node:timers/promises');
const http = require('http');
const fs = require('fs');
const { CohereClientV2 } = require('cohere-ai');
const cron = require('node-cron');
const { Client } = require('../src/index.js');
const { setupVoiceChannel } = require('./voice-handler.js');

function validateEnvVars() {
  const requiredEnvVars = ['DISCORD_TOKEN', 'CO_API_KEY', 'ALLOWED_CHANNEL_ID'];
  const missingVars = requiredEnvVars.filter(v => !process.env[v]);

  if (missingVars.length > 0) {
    console.error(`❌ Error: Environment variable berikut belum diatur: ${missingVars.join(', ')}`);
    console.error('Silakan buat file .env dan isi variabel yang diperlukan sebelum menjalankan bot.');
    process.exit(1);
  }
}

const cohere = new CohereClientV2({
  token: process.env.CO_API_KEY,
});

const client = new Client({
  checkUpdate: false,
});

const ALLOWED_CHANNEL_ID = process.env.ALLOWED_CHANNEL_ID;
const SPECIFIC_USER_IDS = process.env.SPECIFIC_USER_IDS
  ? process.env.SPECIFIC_USER_IDS.split(',').map(id => id.trim())
  : [];
const CRON_CHANNEL_ID = process.env.CRON_CHANNEL_ID;
const CRON_MESSAGE = process.env.CRON_MESSAGE;

let BASE_SYSTEM_PROMPT = '';
try {
  BASE_SYSTEM_PROMPT = fs.readFileSync(`${__dirname}/system_prompt.txt`, 'utf-8');
} catch (error) {
  console.error('❌ Gagal memuat system_prompt.txt. Pastikan file tersebut ada.');
  process.exit(1);
}

const processing = new Set();

const chatHistories = new Map();

const HISTORY_LIMIT = 6;

const commands = new Map();

commands.set('reset', {
  description: 'Mereset memori percakapan dengan user.',
  async execute(message) {
    if (chatHistories.has(message.author.id)) {
      chatHistories.delete(message.author.id);
      console.log(`[INFO] Memori chat untuk ${message.author.username} telah direset.`);
      await message.reply('Memori chat telah direset. Kita mulai dari awal lagi ya.').catch(console.error);
    } else {
      await message.reply('Tidak ada memori chat yang bisa direset.').catch(console.error);
    }
  },
});

commands.set('ping', {
  description: 'Memeriksa latensi bot ke Discord API.',
  async execute(message) {
    const sent = await message.reply('Pinging...');
    const latency = sent.createdTimestamp - message.createdTimestamp;
    sent.edit(`Pong! Latensi: ${latency}ms. Latensi API: ${Math.round(client.ws.ping)}ms.`);
  },
});

function isEligibleForReply(message) {
  if (message.author.id === client.user.id || message.author.bot) {
    return false;
  }
  if (message.channelId !== ALLOWED_CHANNEL_ID) {
    return false;
  }
  if (SPECIFIC_USER_IDS.length > 0 && !SPECIFIC_USER_IDS.includes(message.author.id)) {
    return false;
  }
  if (processing.has(message.id)) {
    return false;
  }
  return true;
}

async function handleCommand(message) {
  if (!message.content.startsWith('!')) return false;

  const commandName = message.content.split(' ')[0].substring(1).toLowerCase();
  const command = commands.get(commandName);

  if (command) {
    await command.execute(message);
    return true;
  }
  return false;
}

async function getAiReply(message, history) {
  try {
    const now = new Date();
    const timeString = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' });
    const dayString = now.toLocaleDateString('id-ID', { weekday: 'long', timeZone: 'Asia/Jakarta' });
    const dynamicSystemPrompt = `${BASE_SYSTEM_PROMPT}\n\nInformasi tambahan untuk lu: Sekarang hari ${dayString}, jam ${timeString} WIB.`;

    const messagesForApi = [
      { role: 'system', content: dynamicSystemPrompt },
      ...history,
      { role: 'user', content: message.content },
    ];

    const response = await cohere.chat({
      model: 'command-r-plus-08-2024',
      messages: messagesForApi,
      maxTokens: 2048,
      temperature: 0.8,
    });

    const aiReply = response.message.content[0].text.trim();
    console.log(`[AI-REPLY] Untuk ${message.author.username}: "${aiReply}"`);

    history.push({ role: 'user', content: message.content });
    history.push({ role: 'assistant', content: aiReply });

    while (history.length > HISTORY_LIMIT) {
      history.shift();
    }

    chatHistories.set(message.author.id, history);

    await message.reply(aiReply);
  } catch (error) {
    console.error(`[ERROR] Gagal saat menghubungi Cohere API: ${error.message}`);
    let errorMessage = '😅 Maaf, AI-nya lagi pusing. Coba lagi nanti.';
    if (error.statusCode === 401 || error.statusCode === 403) {
      errorMessage = '🔑 Waduh, kunci API Cohere-nya salah atau tidak valid nih.';
    } else if (error.statusCode >= 500) {
      errorMessage = '😵‍💫 Server Cohere lagi ada gangguan, coba beberapa saat lagi ya.';
    }
    await message.reply(errorMessage).catch(console.error);
  }
}

client.on('messageCreate', async message => {
  if (!isEligibleForReply(message)) return;

  const isCommand = await handleCommand(message);
  if (isCommand) return;

  console.log(`[INFO] Menerima pesan dari ${message.author.username}: "${message.content}"`);

  processing.add(message.id);

  try {
    const history = chatHistories.get(message.author.id) || [];
    await getAiReply(message, history);
  } finally {
    await sleep(3000);
    processing.delete(message.id);
  }
});

validateEnvVars();

client.once('ready', () => {
  console.log(`[READY] Berhasil login sebagai ${client.user.tag}`);
  console.log('[INFO] Menggunakan Cohere AI untuk balasan.');

  setupVoiceChannel(client);

  if (CRON_CHANNEL_ID && CRON_MESSAGE && cron.validate('0 7 * * *')) {
    cron.schedule('0 7 * * *', async () => {
        try {
          const channel = await client.channels.fetch(CRON_CHANNEL_ID);
          if (channel) await channel.send(CRON_MESSAGE);
          console.log(`[CRON] Pesan terjadwal terkirim ke channel ${CRON_CHANNEL_ID}`);
        } catch (error) {
          console.error(`[ERROR] Gagal mengirim pesan terjadwal: ${error.message}`);
        }
      }, { timezone: 'Asia/Jakarta' });
    console.log('[INFO] Pesan terjadwal telah diaktifkan.');
  }
});

const PORT = process.env.PORT || 3000;
http
  .createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Bot is alive!');
  })
  .listen(PORT, () => console.log(`[INFO] Health check server listening on port ${PORT}`));

client.login(process.env.DISCORD_TOKEN);
