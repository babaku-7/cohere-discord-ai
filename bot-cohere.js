'use strict';
require('dotenv').config();

// ... di dalam fungsi getAiReply
    // Cek apakah AI ingin menggunakan alat (tool)
    if (response.message.tool_calls && response.message.tool_calls.length > 0) {
      const toolCall = response.message.tool_calls[0];
      if (toolCall.name === 'web_search') {
        const searchResult = await webSearch(toolCall.parameters.query);
        // Panggil API lagi dengan hasil pencarian sebagai konteks tambahan
        const secondResponse = await cohere.chat({
          model: 'command-r-plus-08-2024',
          messages: messagesForApi, // Kirim riwayat yang sama
          tool_results: [{ call: toolCall, output: searchResult }], // Tambahkan hasil pencarian
        });
        aiReply = secondResponse.message.content[0].text.trim();
      }
    } else {
      // Jika tidak ada tool yang dipanggil, gunakan jawaban langsung
      aiReply = response.message.content[0].text.trim();
    }
async function webSearch(query) {
  console.log(`[SEARCH] Melakukan pencarian untuk: "${query}"`);
  try {
    // Ini adalah contoh menggunakan API pencarian seperti Serper.dev atau lainnya
    const response = await axios.post('https://google.serper.dev/search', { q: query }, {
      headers: { 'X-API-KEY': process.env.SEARCH_API_KEY, 'Content-Type': 'application/json' }
    });
    // Ambil beberapa hasil teratas dan rangkum
    return JSON.stringify(response.data.organic.slice(0, 3).map(r => ({ title: r.title, snippet: r.snippet })));
  } catch (error) {
    console.error(`[SEARCH-ERROR] Gagal melakukan pencarian: ${error.message}`);
    return "Pencarian gagal dilakukan.";
  }
}
function validateEnvVars() {
  const requiredEnvVars = ['DISCORD_TOKEN', 'CO_API_KEY', 'ALLOWED_CHANNEL_ID', 'SEARCH_API_KEY']; // Pastikan ini ada
  // ...
}
const axios = require('axios'); // Contoh library untuk memanggil API
const { setTimeout: sleep } = require('node:timers/promises');
const http = require('http');
// Bot.js - Auto Reply with AI (Cohere)
const fs = require('fs');
const { CohereClientV2 } = require('cohere-ai');
const cron = require('node-cron');
const { Client } = require('./src/index.js');

/**
 * Memvalidasi bahwa semua environment variables yang dibutuhkan sudah diatur.
 * Jika ada yang kurang, proses akan dihentikan dengan pesan error yang jelas.
 */
function validateEnvVars() {
  const requiredEnvVars = ['DISCORD_TOKEN', 'CO_API_KEY', 'ALLOWED_CHANNEL_ID', 'SEARCH_API_KEY']; // Tambahkan validasi untuk API key pencarian
  const missingVars = requiredEnvVars.filter(v => !process.env[v]);

  if (missingVars.length > 0) {
    console.error(`❌ Error: Environment variable berikut belum diatur: ${missingVars.join(', ')}`);
    console.error('Silakan buat file .env dan isi variabel yang diperlukan sebelum menjalankan bot.');
    process.exit(1);
  }
}

// Setup Cohere API
const cohere = new CohereClientV2({
  token: process.env.CO_API_KEY, // Diambil dari environment variable CO_API_KEY
});

const client = new Client({
  checkUpdate: false,
});

// Bot config
const ALLOWED_CHANNEL_ID = process.env.ALLOWED_CHANNEL_ID;
const VOICE_CHANNEL_ID = process.env.VOICE_CHANNEL_ID;
// Membaca SPECIFIC_USER_IDS dari .env, memisahkan dengan koma, dan membersihkan spasi
const SPECIFIC_USER_IDS = process.env.SPECIFIC_USER_IDS
  ? process.env.SPECIFIC_USER_IDS.split(',').map(id => id.trim())
  : [];
const CRON_CHANNEL_ID = process.env.CRON_CHANNEL_ID;
const CRON_MESSAGE = process.env.CRON_MESSAGE;

// Memuat system prompt dari file eksternal.
let BASE_SYSTEM_PROMPT = '';
try {
  BASE_SYSTEM_PROMPT = fs.readFileSync('./system_prompt.txt', 'utf-8');
} catch (error) {
  console.error('❌ Gagal memuat system_prompt.txt. Pastikan file tersebut ada.');
  process.exit(1); // Keluar jika file prompt tidak ditemukan
}

// Kunci untuk mencegah balasan ganda pada pesan yang sama.
const processing = new Set();

// Menyimpan riwayat chat untuk setiap user.
const chatHistories = new Map();

// Batas jumlah pesan dalam riwayat (user + balasan AI). 6 berarti 3 pasang percakapan.
const HISTORY_LIMIT = 6;

// --- Command Handler ---
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

/**
 * Memeriksa apakah sebuah pesan memenuhi syarat untuk dibalas oleh AI.
 * @param {import('discord.js-selfbot-v13').Message} message Objek pesan yang diterima.
 * @returns {boolean} `true` jika pesan boleh dibalas, `false` jika tidak.
 */
function isEligibleForReply(message) {
  // Jangan reply ke pesan sendiri atau bot lain
  if (message.author.id === client.user.id || message.author.bot) {
    return false;
  }
  // Hanya balas di channel yang diizinkan
  if (message.channelId !== ALLOWED_CHANNEL_ID) {
    return false;
  }
  // Jika ada user spesifik, hanya balas user tersebut
  if (SPECIFIC_USER_IDS.length > 0 && !SPECIFIC_USER_IDS.includes(message.author.id)) {
    return false;
  }
  // Jangan proses pesan yang sama dua kali
  if (processing.has(message.id)) {
    return false;
  }
  return true;
}

/**
 * Menangani perintah khusus seperti !reset.
 * @param {import('discord.js-selfbot-v13').Message} message Objek pesan yang diterima.
 * @returns {boolean} `true` jika pesan adalah perintah dan sudah ditangani, `false` jika bukan.
 */
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

/**
 * Fungsi untuk mencari informasi di internet.
 * Ini adalah fungsi tiruan, perlu diganti dengan API pencarian sungguhan.
 * @param {string} query Kueri pencarian.
 * @returns {Promise<string>} Hasil pencarian.
 */
async function webSearch(query) {
  console.log(`[SEARCH] Melakukan pencarian untuk: "${query}"`);
  try {
    // Ini adalah contoh menggunakan API pencarian seperti Serper.dev atau lainnya
    const response = await axios.post('https://google.serper.dev/search', { q: query }, {
      headers: { 'X-API-KEY': process.env.SEARCH_API_KEY, 'Content-Type': 'application/json' }
    });
    // Ambil beberapa hasil teratas dan rangkum
    return JSON.stringify(response.data.organic.slice(0, 3).map(r => ({ title: r.title, snippet: r.snippet })));
  } catch (error) {
    console.error(`[SEARCH-ERROR] Gagal melakukan pencarian: ${error.message}`);
    return "Pencarian gagal dilakukan.";
  }
}

/**
 * Menghasilkan balasan dari AI menggunakan Cohere.
 * @param {import('discord.js-selfbot-v13').Message} message Objek pesan yang diterima.
 * @param {Array<Object>} history Riwayat percakapan dengan user.
 */
async function getAiReply(message, history) {
  try {
    // Buat system prompt dinamis dengan informasi waktu
    const now = new Date();
    const timeString = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' });
    const dateString = now.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta' });
    const dynamicSystemPrompt = `${BASE_SYSTEM_PROMPT}\n\nInformasi tambahan untuk lu: Sekarang hari ${dateString}, jam ${timeString} WIB.`;

    const messagesForApi = [
      { role: 'system', content: dynamicSystemPrompt },
      ...history,
      { role: 'user', content: message.content },
    ];

    // Definisikan "alat" yang bisa digunakan oleh AI
    const tools = [
      {
        name: 'web_search',
        description: 'Mencari informasi terkini di internet (Google) ketika kamu tidak tahu jawabannya, terutama untuk peristiwa setelah tahun 2023.',
        // Cohere R+ model requires a function definition structure.
        tool_spec: {
          name: 'web_search',
          description: 'Fungsi untuk melakukan pencarian Google dan mendapatkan hasil yang relevan.',
          input_schema: {
            type: 'object',
            properties: {
              query: { type: 'string', description: 'Kueri pencarian yang jelas dan ringkas dalam Bahasa Indonesia.' }
            },
            required: ['query']
          },
        }
      },
    ];

    const response = await cohere.chat({
      model: 'command-r-plus-08-2024',
      messages: messagesForApi,
      tools: tools, // Beri tahu AI tentang alat yang tersedia
      maxTokens: 2048,
      temperature: 0.8,
    });

    let aiReply = '';

    // Cek apakah AI ingin menggunakan alat (tool)
    if (response.message.tool_calls && response.message.tool_calls.length > 0) {
      const toolCall = response.message.tool_calls.find(tc => tc.name === 'web_search');
      if (toolCall) {
        const searchResult = await webSearch(toolCall.input.query);
        // Panggil API lagi dengan hasil pencarian sebagai konteks tambahan
        const secondResponse = await cohere.chat({
          model: 'command-r-plus-08-2024',
          messages: messagesForApi, // Kirim riwayat yang sama
          tool_results: [{ call: toolCall, output: searchResult }], // Tambahkan hasil pencarian
        });
        aiReply = secondResponse.message.content[0].text.trim();
      }
    } else {
      // Jika tidak ada tool yang dipanggil, gunakan jawaban langsung
      aiReply = response.message.content[0].text.trim();
    }
    console.log(`[AI-REPLY] Untuk ${message.author.username}: "${aiReply}"`);

    // Simpan pesan user dan balasan AI ke riwayat
    history.push({ role: 'user', content: message.content });
    history.push({ role: 'assistant', content: aiReply });

    // Batasi panjang riwayat
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

/**
 * Bergabung ke voice channel yang ditentukan di environment variable.
 * Fungsi ini akan mencoba bergabung kembali jika terjadi error.
 */
async function joinVoiceChannel() {
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
    // Tangani error timeout spesifik dari library, tapi anggap berhasil karena bot tetap join.
    if (channel && error.message.includes('Connection not established within 15 seconds')) {
      console.log(`[INFO] Berhasil bergabung ke voice channel: ${channel.name} (Muted), meskipun ada peringatan timeout.`);
    } else {
      console.error(`[ERROR] Gagal bergabung ke voice channel: ${error.message}`);
    }
  }
}

// Auto-Reply ke pesan DENGAN AI
client.on('messageCreate', async message => {
  // Jangan proses pesan jika tidak memenuhi syarat (misal, dari channel yang salah, dari bot, dll.)
  if (!isEligibleForReply(message)) return;

  // Cek apakah pesan adalah sebuah perintah. Jika ya, eksekusi dan hentikan proses AI.
  const isCommand = await handleCommand(message);
  if (isCommand) return;

  console.log(`[INFO] Menerima pesan dari ${message.author.username}: "${message.content}"`);

  processing.add(message.id);

  try {
    // Tampilkan indikator "sedang mengetik" di channel
    await message.channel.sendTyping();

    const history = chatHistories.get(message.author.id) || [];
    await getAiReply(message, history);
  } finally {
    // Hapus tanda proses setelah beberapa saat
    await sleep(3000);
    processing.delete(message.id);
  }
});

// --- Event Handler untuk Bot Siap ---
validateEnvVars(); // Validasi environment variables sebelum login

// Gunakan client.once('ready', ...) untuk memastikan kode ini hanya berjalan sekali.
client.once('ready', () => {
  console.log(`[READY] Berhasil login sebagai ${client.user.tag}`);
  console.log('[INFO] Menggunakan Cohere AI untuk balasan.');

  // Bergabung ke voice channel jika VOICE_CHANNEL_ID diatur
  joinVoiceChannel();

  // Jadwalkan pesan jika diatur di .env
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

// --- Event Handler untuk Voice State ---
client.on('voiceStateUpdate', (oldState, newState) => {
  // Cek jika bot yang terputus dari voice channel
  if (oldState.member.id === client.user.id && oldState.channelId && !newState.channelId) {
    console.log('[WARN] Koneksi voice channel terputus. Mencoba untuk bergabung kembali...');
    // Tunggu beberapa detik sebelum mencoba join lagi
    setTimeout(() => {
      joinVoiceChannel();
    }, 5000); // Delay 5 detik
  }
});

// --- HTTP Server for Health Checks (Render/Railway) ---
const PORT = process.env.PORT || 3000;
http
  .createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Bot is alive!');
  })
  .listen(PORT, () => console.log(`[INFO] Health check server listening on port ${PORT}`));

client.login(process.env.DISCORD_TOKEN); // Diambil dari environment variable DISCORD_TOKEN
