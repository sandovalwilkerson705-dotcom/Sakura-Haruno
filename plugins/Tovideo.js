// plugins/tovideo.js — sticker (.webp) → .mp4 con fallback a API
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');
const { spawn } = require('child_process');
const { promisify } = require('util');
const { pipeline } = require('stream');
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const streamPipeline = promisify(pipeline);

const CDN_ENDPOINT = "https://cdn.skyultraplus.com/upload.php";
const NEOXR_URL    = "https://api.neoxr.eu/api/webp2mp4";
const NEOXR_KEY    = "russellxz";

function unwrapMessage(m) {
  let n = m;
  while (
    n?.viewOnceMessage?.message ||
    n?.viewOnceMessageV2?.message ||
    n?.viewOnceMessageV2Extension?.message ||
    n?.ephemeralMessage?.message
  ) {
    n =
      n.viewOnceMessage?.message ||
      n.viewOnceMessageV2?.message ||
      n.viewOnceMessageV2Extension?.message ||
      n.ephemeralMessage?.message;
  }
  return n;
}
function getQuotedSticker(msg) {
  const m = unwrapMessage(msg?.message) || {};
  const ctx = m?.extendedTextMessage?.contextInfo;
  const q = ctx?.quotedMessage ? unwrapMessage(ctx.quotedMessage) : null;
  return q?.stickerMessage || null;
}

async function ffmpegWebpToMp4(inputPath, outputPath, isAnimated = true) {
  return new Promise((resolve, reject) => {
    const args = [
      '-y',
      ...(isAnimated ? [] : ['-loop', '1', '-t', '4', '-r', '24']),
      '-i', inputPath,
      '-c:v', 'libx264',
      '-preset', 'fast',
      '-pix_fmt', 'yuv420p',
      '-movflags', '+faststart',
      outputPath,
    ];
    const ff = spawn('ffmpeg', args);
    let stderr = '';
    ff.stderr.on('data', d => (stderr += d.toString()));
    ff.on('exit', code => {
      if (code === 0 && fs.existsSync(outputPath) && fs.statSync(outputPath).size > 0) return resolve();
      reject(new Error(stderr || 'ffmpeg failed'));
    });
  });
}

const handler = async (msg, { conn, command }) => {
  const chatId = msg.key.remoteJid;
  const pref = global.prefixes?.[0] || ".";

  const quotedSticker = getQuotedSticker(msg);
  if (!quotedSticker) {
    await conn.sendMessage(chatId, {
      text: `⚠️ *Responde a un sticker para convertirlo a video.*\n\n📌 Ejemplo: *${pref}${command || 'tovideo'}*`,
    }, { quoted: msg });
    return;
  }

  try { await conn.sendMessage(chatId, { react: { text: '⏳', key: msg.key } }); } catch {}

  const tmp = path.join(__dirname, '../tmp');
  if (!fs.existsSync(tmp)) fs.mkdirSync(tmp, { recursive: true });

  const input  = path.join(tmp, `${Date.now()}.webp`);
  const output = path.join(tmp, `${Date.now()}_out.mp4`);

  try {
    // Descargar sticker
    const stStream = await downloadContentFromMessage(quotedSticker, 'sticker');
    const ws = fs.createWriteStream(input);
    for await (const chunk of stStream) ws.write(chunk);
    ws.end();
    await new Promise(r => ws.on('finish', r));

    // Convertir con ffmpeg local (detecta animado si el campo existe; si no, asumimos animado)
    const animated = typeof quotedSticker.isAnimated === 'boolean' ? quotedSticker.isAnimated : true;
    try {
      await ffmpegWebpToMp4(input, output, animated);
    } catch (eLocal) {
      // Fallback: subir al CDN y usar API externa
      const form = new FormData();
      form.append("file", fs.createReadStream(input));
      const up = await axios.post(CDN_ENDPOINT, form, { headers: form.getHeaders(), timeout: 120000 });
      if (!up.data?.url) throw new Error("No se pudo subir el sticker al CDN");

      const conv = await axios.get(`${NEOXR_URL}?url=${encodeURIComponent(up.data.url)}&apikey=${NEOXR_KEY}`, { timeout: 120000 });
      const videoUrl = conv.data?.data?.url;
      if (!videoUrl) throw new Error("No se pudo convertir el sticker a video (API)");

      const vStream = await axios.get(videoUrl, { responseType: 'stream', timeout: 120000 });
      const wv = fs.createWriteStream(output);
      await streamPipeline(vStream.data, wv);
    }

    // Enviar video
    await conn.sendMessage(chatId, {
      video: fs.readFileSync(output),
      mimetype: 'video/mp4',
      caption: '✅ *Sticker convertido a video.*\n\n🍧 _La Suki Bot_'
    }, { quoted: msg });

    try { await conn.sendMessage(chatId, { react: { text: '✅', key: msg.key } }); } catch {}
  } catch (err) {
    console.error("❌ Error en tovideo:", err);
    await conn.sendMessage(chatId, { text: `❌ *Error:* ${err.message}` }, { quoted: msg });
    try { await conn.sendMessage(chatId, { react: { text: '❌', key: msg.key } }); } catch {}
  } finally {
    // Limpieza segura
    for (const f of [input, output]) {
      try { if (f && fs.existsSync(f)) fs.unlinkSync(f); } catch {}
    }
  }
};

handler.command = ['tovideo'];
handler.help = ['tovideo'];
handler.tags = ['tools'];
handler.register = true;

module.exports = handler;
