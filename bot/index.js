'use strict';

require('dotenv').config();

const http = require('http');
const process = require('node:process');
const { setupVoiceChannel } = require('./voice-handler.js');
const { Client } = require('../src/index.js');

function validateEnvVars() {
  const requiredEnvVars = ['DISCORD_TOKEN', 'VOICE_CHANNEL_ID'];
  const missingVars = requiredEnvVars.filter(variable => !process.env[variable]);

  if (missingVars.length > 0) {
    console.error(`Environment variable belum diatur: ${missingVars.join(', ')}`);
    process.exit(1);
  }
}

validateEnvVars();

const client = new Client({
  checkUpdate: false,
});

client.once('ready', () => {
  console.log(`[READY] Berhasil login sebagai ${client.user.tag}`);
  setupVoiceChannel(client);
});

const port = process.env.PORT || 3000;
http
  .createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Voice bot is alive!');
  })
  .listen(port, () => console.log(`[INFO] Health check server listening on port ${port}`));

client.login(process.env.DISCORD_TOKEN);
