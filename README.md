# Discord Bot Cohere AI

Bot auto-reply Discord menggunakan AI Cohere dengan gaya bicara natural.

> [!WARNING]
> **Risiko Penggunaan Self-Bot**
> Menggunakan akun pengguna (self-bot) untuk otomatisasi adalah pelanggaran terhadap [Persyaratan Layanan Discord](https://discord.com/terms) dan dapat menyebabkan akun Anda diblokir secara permanen. Gunakan dengan risiko Anda sendiri. Proyek ini dibuat hanya untuk tujuan edukasi.

> [!IMPORTANT]
> Proyek ini didasarkan pada `discord.js-selfbot-v13` yang dilisensikan di bawah **GPL-3.0**. Oleh karena itu, proyek ini juga tunduk pada lisensi yang sama.

---

## Setup Lokal

```bash
npm install
export CO_API_KEY=YOUR_COHERE_API_KEY
export DISCORD_TOKEN=YOUR_DISCORD_TOKEN
npm start
```

## Deploy ke Render

1. Fork / Push ke GitHub
2. Buka <https://render.com> lalu pilih **New → Web Service**
3. Hubungkan repository GitHub ini
4. Gunakan pengaturan berikut:
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
5. Tambahkan Environment Variables:
   - `CO_API_KEY` = your-cohere-api-key
   - `DISCORD_TOKEN` = your-discord-token
   - `ALLOWED_CHANNEL_ID` = your-channel-id
6. Klik **Create Web Service**.

## Konfigurasi

Semua konfigurasi utama dilakukan melalui **Environment Variables**.

- **System Prompt**: Ubah file `bot/system_prompt.txt` untuk mengatur kepribadian dan gaya bicara AI.
- **Temperature & Max Tokens**: Ubah konstanta di bagian atas file `bot/index.js` untuk kreativitas dan panjang jawaban.

## Environment Variables

| Variabel | Wajib | Deskripsi |
|---|---|---|
| `DISCORD_TOKEN` | **Ya** | Token akun pengguna Discord. |
| `CO_API_KEY` | **Ya** | Kunci API dari Cohere. |
| `ALLOWED_CHANNEL_ID` | **Ya** | ID channel tempat bot akan aktif membalas. |
| `VOICE_CHANNEL_ID` | Tidak | (Opsional) ID voice channel agar bot tetap online di Render. |
| `SPECIFIC_USER_IDS` | Tidak | (Opsional) Batasi balasan hanya untuk user tertentu (pisahkan ID dengan koma). |
| `CRON_CHANNEL_ID` | Tidak | (Opsional) ID channel untuk pesan terjadwal. |
| `CRON_MESSAGE` | Tidak | (Opsional) Isi pesan yang akan dikirim terjadwal. |

## Perintah

- `!reset` - Menghapus riwayat percakapan denganmu, memulai dari awal.
- `!ping` - Memeriksa latensi bot.

## Features

✅ Reply hanya ke user (bukan bot)
✅ Reply hanya di channel tertentu
✅ Jawaban santai & natural
✅ Menggunakan Cohere AI
✅ Support Bahasa Indonesia
✅ Penjadwalan pesan dengan `node-cron`
✅ Bot bisa masuk ke voice channel

## License

GPL-3.0
