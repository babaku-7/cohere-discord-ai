# Discord Stay Voice

Self-bot Discord sederhana yang hanya login dan tetap terhubung ke voice

> [!WARNING]
> **Risiko Penggunaan Self-Bot**
> Menggunakan akun pengguna (self-bot) untuk otomatisasi adalah pelanggaran
> terhadap [Persyaratan Layanan Discord](https://discord.com/terms) dan dapat
> menyebabkan akun diblokir permanen. Gunakan dengan risiko Anda sendiri.

> [!IMPORTANT]
> Proyek ini didasarkan pada `discord.js-selfbot-v13` yang dilisensikan di
> bawah **GPL-3.0**. Oleh karena itu, proyek ini juga tunduk pada lisensi yang
> sama.

## Setup Lokal

```bash
npm install
export DISCORD_TOKEN=YOUR_DISCORD_TOKEN
export VOICE_CHANNEL_ID=YOUR_VOICE_CHANNEL_ID
npm start
```

Bot akan bergabung ke voice channel setelah login dan mencoba bergabung
kembali jika koneksinya terputus.

## Deploy ke Render

1. Hubungkan repository ke Render sebagai Web Service.
2. Gunakan **Build Command** `npm install`.
3. Gunakan **Start Command** `npm start`.
4. Tambahkan environment variables berikut:
   - `DISCORD_TOKEN`: token akun Discord.
   - `VOICE_CHANNEL_ID`: ID voice channel tujuan.

Health check tersedia melalui port yang diberikan oleh environment `PORT`.

## License

GPL-3.0
