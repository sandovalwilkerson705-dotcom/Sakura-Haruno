const handler = async (msg, { conn }) => {
  const chatId = msg.key.remoteJid;
  const pref = (global?.prefixes?.[0]) || (global?.prefix) || ".";

  await conn.sendMessage2(chatId, { react: { text: "👻", key: msg.key } }, msg);

  const caption = `†𝙈𝙀𝙉𝙐 𝙍𝙋𝙂†

𖠁𝙋𝙍𝙀𝙁𝙄𝙅𝙊𖠁
╭─────◆
│๛ Prefijo actual: 『 ${pref} 』
│๛ Úsalo antes de cada comando
╰─────◆

𖠁𝙋𝙀𝙍𝙁𝙄𝙇𖠁
╭─────◆
│๛ ${pref}rpg <Nombre Apellido Edad Fecha>
│   — Registrarte en el RPG
│๛ ${pref}nivel
│   — Ver tu progreso
│๛ ${pref}nivelper
│   — Ver tu personaje principal
│๛ ${pref}verper / ${pref}verpersonajes
│   — Ver todos tus personajes
│๛ ${pref}vermascotas / ${pref}vermas
│   — Ver tus mascotas
│๛ ${pref}saldo
│   — Ver tu saldo
╰─────◆

𖠁𝙋𝙀𝙍𝙎𝙊𝙉𝘼𝙅𝙀𖠁
╭─────◆
│๛ ${pref}luchar
│๛ ${pref}volar
│๛ ${pref}enemigos
│๛ ${pref}otromundo
│๛ ${pref}otrouniverso
│๛ ${pref}mododios
│๛ ${pref}mododiablo
│๛ ${pref}superpoder
│๛ ${pref}poder
│๛ ${pref}podermaximo
╰─────◆

𖠁𝙈𝘼𝙎𝘾𝙊𝙏𝘼𝙎𖠁
╭─────◆
│๛ ${pref}daragua
│๛ ${pref}darcomida
│๛ ${pref}darcariño
│๛ ${pref}entrenar
│๛ ${pref}cazar
│๛ ${pref}pasear
│๛ ${pref}presumir
│๛ ${pref}supermascota
│๛ ${pref}batallamascota / ${pref}batallamas  — Retar
│๛ ${pref}gomascota / ${pref}gomas            — Aceptar
╰─────◆

𖠁𝘽𝘼𝙏𝘼𝙇𝙇𝘼 𝘼𝙉𝙄𝙈𝙀𖠁
╭─────◆
│๛ ${pref}batallaanime / ${pref}batallaani  — Retar (menciona o cita)
│๛ ${pref}goani / ${pref}goper              — Aceptar y pelear
╰─────◆

𖠁𝘽𝘼𝙏𝘼𝙇𝙇𝘼 𝘿𝙀 𝙐𝙎𝙐𝘼𝙍𝙄𝙊𝙎𖠁
╭─────◆
│๛ ${pref}batallauser  — Retar (entre usuarios)
│๛ ${pref}gouser       — Aceptar y pelear
╰─────◆

𖠁𝙐𝙎𝙐𝘼𝙍𝙄𝙊𝙎 𝘾𝙊𝙈𝘼𝙉𝘿𝙊𝙎𖠁
╭─────◆
│๛ ${pref}minar
│๛ ${pref}work
│๛ ${pref}picar
│๛ ${pref}correr
│๛ ${pref}estudiar
│๛ ${pref}claim
│๛ ${pref}cofre
│๛ ${pref}talar
│๛ ${pref}cocinar
│๛ ${pref}robar
╰─────◆

𖠁𝙏𝙄𝙀𝙉𝘿𝘼𝙎 & 𝘽𝘼𝙉𝘾𝙊𖠁
╭─────◆
│๛ ${pref}tiendaper         — Tienda de personajes
│๛ ${pref}tiendamascotas     — Tienda de mascotas
│๛ ${pref}comprar           — Comprar personaje
│๛ ${pref}comprarmas        — Comprar mascota
│๛ ${pref}banco             — Ver/usar banco
│๛ ${pref}tiendabank        — Ver opciones del banco
│๛ ${pref}comprarbank       — Comprar/contratar en el banco
╰─────◆

𖠁𝘼𝘿𝙈𝙄𝙉𝙄𝙎𝙏𝙍𝘼𝘾𝙄𝙊́𝙉 𝙍𝙋𝙂 (OWNER)𖠁
╭─────◆
│๛ ${pref}addper        — Agregar personaje a un usuario
│๛ ${pref}addmascota    — Agregar mascota a un usuario
│๛ ${pref}addtime       — Ajustar tiempos/cooldowns
│๛ ${pref}addmoney      — Agregar créditos
│๛ ${pref}restbank      — Resetear ajustes del banco
│๛ ${pref}delrpg        — Eliminar registro RPG de un usuario
│๛ ${pref}detelerpg     — Eliminar/depurar por número (RPG)
│๛ ${pref}dar
│๛ ${pref}addbank
╰─────◆

✨ Disfruta el mundo RPG de *Sakura Haruno*. ¡Suerte, héroe!`;

  await conn.sendMessage2(
    chatId,
    {
      image: { url: "https://cdn.russellxz.click/012aac15.jpg" },
      caption
    },
    msg
  );

  await conn.sendMessage2(chatId, { react: { text: "✅", key: msg.key } }, msg);
};

handler.command = ["menurpg", "menuRPG"];
module.exports = handler;
