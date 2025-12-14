// commands/play.js
const axios = require("axios");
const yts = require("yt-search");
const fs = require("fs");
const path = require("path");
const ffmpeg = require("fluent-ffmpeg");
const { promisify } = require("util");
const { pipeline } = require("stream");
const streamPipe = promisify(pipeline);

// ==== NUEVA CONFIG DE API ====
const API_BASE = process.env.API_BASE || "https://api-adonix.ultraplus.click";
const API_KEY  = process.env.API_KEY  || "DemonKeytechbot"; // <-- tu nueva API Key

// Almacena tareas pendientes por previewMessageId
const pending = {};

// Utilidad: descarga a disco y devuelve ruta
async function downloadToFile(url, filePath) {
  const res = await axios.get(url, { responseType: "stream" });
  await streamPipe(res.data, fs.createWriteStream(filePath));
  return filePath;
}

// Utilidad: tamaño en MB (decimal)
function fileSizeMB(filePath) {
  const b = fs.statSync(filePath).size;
  return b / (1024 * 1024);
}

// Llama a la NUEVA API para audio
async function callMyApiAudio(url) {
  try {
    const r = await axios.get(`${API_BASE}/download/ytaudio`, {
      params: { 
        url: url,
        apikey: API_KEY
      },
      timeout: 60000
    });
    
    // Estructura esperada de la nueva API
    if (!r.data || !r.data.success) {
      throw new Error(r.data.message || "Error en la API de audio");
    }
    
    return {
      url: r.data.result || r.data.downloadUrl,
      title: r.data.title || "Audio YouTube",
      duration: r.data.duration || "00:00"
    };
  } catch (error) {
    console.error("Error API audio:", error.message);
    throw new Error(`API Audio: ${error.message}`);
  }
}

// Llama a la NUEVA API para video
async function callMyApiVideo(url) {
  try {
    const r = await axios.get(`${API_BASE}/download/ytvideo`, {
      params: { 
        url: url,
        apikey: API_KEY
      },
      timeout: 60000
    });
    
    // Estructura esperada de la nueva API
    if (!r.data || !r.data.success) {
      throw new Error(r.data.message || "Error en la API de video");
    }
    
    return {
      url: r.data.result || r.data.downloadUrl,
      title: r.data.title || "Video YouTube",
      duration: r.data.duration || "00:00",
      quality: r.data.quality || "720p"
    };
  } catch (error) {
    console.error("Error API video:", error.message);
    throw new Error(`API Video: ${error.message}`);
  }
}

module.exports = async (msg, { conn, text }) => {
  const pref = global.prefixes?.[0] || ".";

  if (!text || !text.trim()) {
    return conn.sendMessage(
      msg.key.remoteJid,
      { text: `✳️ Usa:\n${pref}play <término>\nEj: *${pref}play* bad bunny diles` },
      { quoted: msg }
    );
  }

  // reacción de carga
  await conn.sendMessage(msg.key.remoteJid, {
    react: { text: "⏳", key: msg.key }
  });

  // búsqueda
  const res = await yts(text);
  const video = res.videos?.[0];
  if (!video) {
    await conn.sendMessage(msg.key.remoteJid, {
      react: { text: "❌", key: msg.key }
    });
    return conn.sendMessage(
      msg.key.remoteJid,
      { text: "❌ Sin resultados." },
      { quoted: msg }
    );
  }

  const { url: videoUrl, title, timestamp: duration, views, author, thumbnail } = video;
  const viewsFmt = (views || 0).toLocaleString();

  const caption = `
 *SAKURA HARUNO*

📀 𝙸𝚗𝚏𝚘 𝚍𝚎𝚕 𝚟𝚒𝚍𝚎𝚘:
❥ 𝑻𝒊𝒕𝒖𝒍𝒐: ${title}
❥ 𝑫𝒖𝒓𝒂𝒄𝒊𝒐𝒏: ${duration}
❥ 𝑽𝒊𝒔𝒕𝒂𝒔: ${viewsFmt}
❥ 𝑨𝒖𝒕𝒐𝒓: ${author?.name || author || "Desconocido"}
❥ 𝑳𝒊𝒏𝒌: ${videoUrl}
❥ API: api-adonix.ultraplus.click

📥 𝙾𝚙𝚌𝚒𝚘𝚗𝚎𝚜 𝚍𝚎 𝙳𝚎𝚜𝚌𝚊𝚛𝚐𝚊 (reacciona o responde al mensaje):
☛ 👍 Audio MP3     (1 / audio)
☛ ❤️ Video MP4     (2 / video)
☛ 📄 Audio Doc     (4 / audiodoc)
☛ 📁 Video Doc     (3 / videodoc)

*SAKURA HARUNO*
`.trim();

  // envía preview
  const preview = await conn.sendMessage(
    msg.key.remoteJid,
    { image: { url: thumbnail }, caption },
    { quoted: msg }
  );

  // guarda trabajo
  pending[preview.key.id] = {
    chatId: msg.key.remoteJid,
    videoUrl,
    title,
    commandMsg: msg,
    done: { audio: false, video: false, audioDoc: false, videoDoc: false }
  };

  // confirmación
  await conn.sendMessage(msg.key.remoteJid, {
    react: { text: "✅", key: msg.key }
  });

  // listener único
  if (!conn._playproListener) {
    conn._playproListener = true;
    conn.ev.on("messages.upsert", async ev => {
      for (const m of ev.messages) {
        // 1) REACCIONES
        if (m.message?.reactionMessage) {
          const { key: reactKey, text: emoji } = m.message.reactionMessage;
          const job = pending[reactKey.id];
          if (job) {
            await handleDownload(conn, job, emoji, job.commandMsg);
          }
        }

        // 2) RESPUESTAS CITADAS
        try {
          const context = m.message?.extendedTextMessage?.contextInfo;
          const citado = context?.stanzaId;
          const texto = (
            m.message?.conversation?.toLowerCase() ||
            m.message?.extendedTextMessage?.text?.toLowerCase() ||
            ""
          ).trim();
          const job = pending[citado];
          const chatId = m.key.remoteJid;
          if (citado && job) {
            // AUDIO
            if (["1", "audio", "4", "audiodoc"].includes(texto)) {
              const docMode = ["4", "audiodoc"].includes(texto);
              await conn.sendMessage(chatId, { react: { text: docMode ? "📄" : "🎵", key: m.key } });
              await conn.sendMessage(chatId, { text: `🎶 Descargando audio...` }, { quoted: m });
              await downloadAudio(conn, job, docMode, m);
            }
            // VIDEO
            else if (["2", "video", "3", "videodoc"].includes(texto)) {
              const docMode = ["3", "videodoc"].includes(texto);
              await conn.sendMessage(chatId, { react: { text: docMode ? "📁" : "🎬", key: m.key } });
              await conn.sendMessage(chatId, { text: `🎥 Descargando video...` }, { quoted: m });
              await downloadVideo(conn, job, docMode, m);
            }
            // AYUDA
            else {
              await conn.sendMessage(chatId, {
                text: `⚠️ Opciones válidas:\n1/audio, 4/audiodoc → audio\n2/video, 3/videodoc → video`
              }, { quoted: m });
            }

            // elimina de pending después de 5 minutos
            if (!job._timer) {
              job._timer = setTimeout(() => delete pending[citado], 5 * 60 * 1000);
            }
          }
        } catch (e) {
          console.error("Error en detector citado:", e);
        }
      }
    });
  }
};

async function handleDownload(conn, job, choice) {
  const mapping = {
    "👍": "audio",
    "❤️": "video",
    "📄": "audioDoc",
    "📁": "videoDoc"
  };
  const key = mapping[choice];
  if (key) {
    const isDoc = key.endsWith("Doc");
    await conn.sendMessage(job.chatId, { text: `⏳ Descargando ${isDoc ? "documento" : key}…` }, { quoted: job.commandMsg });
    if (key.startsWith("audio")) await downloadAudio(conn, job, isDoc, job.commandMsg);
    else await downloadVideo(conn, job, isDoc, job.commandMsg);
  }
}

async function downloadAudio(conn, job, asDocument, quoted) {
  const { chatId, videoUrl, title } = job;

  try {
    // 1) Pide a la NUEVA API de audio
    const data = await callMyApiAudio(videoUrl);
    const mediaUrl = data.url;

    if (!mediaUrl) throw new Error("No se pudo obtener URL de audio");

    // 2) Descarga
    const tmp = path.join(__dirname, "../tmp");
    if (!fs.existsSync(tmp)) fs.mkdirSync(tmp, { recursive: true });

    const inFile = path.join(tmp, `${Date.now()}_audio.mp3`);
    await downloadToFile(mediaUrl, inFile);

    // 3) Límite ~99MB
    const sizeMB = fileSizeMB(inFile);
    if (sizeMB > 99) {
      try { fs.unlinkSync(inFile); } catch {}
      await conn.sendMessage(chatId, { text: `❌ El archivo de audio pesa ${sizeMB.toFixed(2)}MB (>99MB).` }, { quoted });
      return;
    }

    // 4) Enviar
    const buffer = fs.readFileSync(inFile);
    await conn.sendMessage(chatId, {
      [asDocument ? "document" : "audio"]: buffer,
      mimetype: "audio/mpeg",
      fileName: `${title.replace(/[^\w\s.-]/gi, '')}.mp3`
    }, { quoted });

    try { fs.unlinkSync(inFile); } catch {}
  } catch (error) {
    console.error("Error descargando audio:", error);
    await conn.sendMessage(chatId, { 
      text: `❌ Error al descargar audio:\n${error.message}` 
    }, { quoted });
  }
}

async function downloadVideo(conn, job, asDocument, quoted) {
  const { chatId, videoUrl, title } = job;

  try {
    // 1) Pide a la NUEVA API de video
    const data = await callMyApiVideo(videoUrl);
    const mediaUrl = data.url;

    if (!mediaUrl) throw new Error("No se pudo obtener URL de video");

    // 2) Descarga
    const tmp = path.join(__dirname, "../tmp");
    if (!fs.existsSync(tmp)) fs.mkdirSync(tmp, { recursive: true });
    
    const file = path.join(tmp, `${Date.now()}_video.mp4`);
    await downloadToFile(mediaUrl, file);

    // 3) Límite ~99MB
    const sizeMB = fileSizeMB(file);
    if (sizeMB > 99) {
      try { fs.unlinkSync(file); } catch {}
      await conn.sendMessage(chatId, { text: `❌ El video pesa ${sizeMB.toFixed(2)}MB (>99MB).` }, { quoted });
      return;
    }

    // 4) Enviar
    await conn.sendMessage(chatId, {
      [asDocument ? "document" : "video"]: fs.readFileSync(file),
      mimetype: "video/mp4",
      fileName: `${title.replace(/[^\w\s.-]/gi, '')}.mp4`,
      caption: `🎬 𝐀𝐪𝐮𝐢́ 𝐭𝐢𝐞𝐧𝐞𝐬 𝐭𝐮 𝐯𝐢𝐝𝐞𝐨~ 💫\n• API: api-adonix.ultraplus.click\n© SAKURA HARUNO`
    }, { quoted });

    try { fs.unlinkSync(file); } catch {}
  } catch (error) {
    console.error("Error descargando video:", error);
    await conn.sendMessage(chatId, { 
      text: `❌ Error al descargar video:\n${error.message}` 
    }, { quoted });
  }
}

// Comando
module.exports.command = ["play"];