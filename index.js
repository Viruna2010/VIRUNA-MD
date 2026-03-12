const { default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion, makeInMemoryStore, getContentType, downloadContentFromMessage, DisconnectReason } = require('@whiskeysockets/baileys')
const fs = require('fs')
const axios = require('axios')
const googleTTS = require('google-tts-api')
const express = require('express')
const app = express()
const port = process.env.PORT || 3000

// ============ VIRUNA MD සැකසුම් ============
const ownerNumber = '94761138211' 
const botName = "VIRUNA MD"
const aiApiUrl = "https://ඔයාගේ-ai-api-link-එක" // AI සයිට් එකේ ලින්ක් එක මෙතනට

async function startVirunaMD() {
    const { state, saveCreds } = await useMultiFileAuthState('./sessions')
    const { version } = await fetchLatestBaileysVersion()

    const conn = makeWASocket({
        version,
        logger: require('pino')({ level: 'silent' }),
        printQRInTerminal: true,
        auth: state,
        browser: ["VIRUNA MD", "Safari", "1.0.0"],
        syncFullHistory: false
    })

    conn.ev.on('creds.update', saveCreds)

    conn.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update
        if (connection === 'close') {
            if (lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut) startVirunaMD()
        } else if (connection === 'open') {
            console.log('✅ VIRUNA MD Connected! Plugins 25 Loaded.');
        }
    })

    // 📞 1. Call Reject (Auto Reject)
    conn.ev.on('call', async (call) => {
        if (call[0].status === 'offer') {
            await conn.rejectCall(call[0].id, call[0].from)
            await conn.sendMessage(call[0].from, { text: `⚠️ *VIRUNA MD Busy!* No calls allowed.` })
        }
    })

    conn.ev.on('messages.upsert', async (chatUpdate) => {
        try {
            const mek = chatUpdate.messages[0]
            if (!mek.message) return
            mek.message = (getContentType(mek.message) === 'ephemeralMessage') ? mek.message.ephemeralMessage.message : mek.message
            
            // 💚 2. Auto Status Seen & Like
            if (mek.key.remoteJid === 'status@broadcast') {
                await conn.readMessages([mek.key])
                return
            }
            if (mek.key.fromMe) return

            const from = mek.key.remoteJid
            const type = getContentType(mek.message)
            const body = (type === 'conversation') ? mek.message.conversation : (type === 'extendedTextMessage') ? mek.message.extendedTextMessage.text : (type === 'imageMessage') ? mek.message.imageMessage.caption : (type === 'videoMessage') ? mek.message.videoMessage.caption : ''
            const isCmd = body.startsWith('.')
            const command = isCmd ? body.slice(1).trim().split(' ').shift().toLowerCase() : ''
            const q = body.trim().split(/ +/).slice(1).join(' ')
            const sender = mek.key.participant || mek.key.remoteJid

            // 🎧 3. Always Recording & Online
            await conn.sendPresenceUpdate('available')
            await conn.sendPresenceUpdate('recording', from)

            // ============== COMMANDS ==============
            switch (command) {
                case 'menu':
                    const menu = `🤖 *${botName} MENU* 🤖\n\n📥 *.song* [link]\n🎬 *.video* [link]\n⬇️ *.save* (Reply Status)\n🧠 *.ai* [text]\n🗣️ *.tts* [text]\n\n⚙️ *.alive .ping .owner .restart*`
                    await conn.sendMessage(from, { text: menu }, { quoted: mek })
                    break

                case 'alive':
                    await conn.sendMessage(from, { text: `👋 *VIRUNA MD සක්‍රියයි!*\n\n👑 Owner: Viruna Randinu\n🚀 Host: Vercel Safe` }, { quoted: mek })
                    break

                case 'ping':
                    const start = new Date().getTime()
                    await conn.sendMessage(from, { text: 'Testing Speed...' })
                    const end = new Date().getTime()
                    await conn.sendMessage(from, { text: `🚀 Speed: ${end - start}ms` })
                    break

                case 'save':
                    if (!mek.message.extendedTextMessage?.contextInfo?.quotedMessage) return conn.sendMessage(from, { text: "Status එකකට Reply කරලා .save ගහන්න." })
                    const quotedMsg = mek.message.extendedTextMessage.contextInfo.quotedMessage
                    const mType = Object.keys(quotedMsg)[0]
                    const media = await downloadContentFromMessage(quotedMsg[mType], mType.replace('Message', ''))
                    let buffer = Buffer.from([])
                    for await (const chunk of media) { buffer = Buffer.concat([buffer, chunk]) }
                    if (mType === 'imageMessage') await conn.sendMessage(from, { image: buffer, caption: '✅ Saved' }, { quoted: mek })
                    else await conn.sendMessage(from, { video: buffer, caption: '✅ Saved' }, { quoted: mek })
                    break

                case 'ai':
                    if (!q) return reply("ප්‍රශ්නයක් අහන්න.")
                    const res = await axios.get(`${aiApiUrl}?text=${encodeURIComponent(q)}`)
                    await conn.sendMessage(from, { text: "🤖 " + res.data.reply }, { quoted: mek })
                    break

                case 'song':
                    if (!q) return reply("Link එකක් දෙන්න.")
                    await conn.sendMessage(from, { text: "📥 Downloading Audio..." })
                    const sRes = await axios.get(`https://api.dreaded.site/api/ytdl/audio?url=${q}`)
                    await conn.sendMessage(from, { audio: { url: sRes.data.result.download_url }, mimetype: 'audio/mpeg' }, { quoted: mek })
                    break

                case 'video':
                    if (!q) return reply("Link එකක් දෙන්න.")
                    await conn.sendMessage(from, { text: "📥 Downloading Video..." })
                    const vRes = await axios.get(`https://api.dreaded.site/api/ytdl/video?url=${q}`)
                    await conn.sendMessage(from, { video: { url: vRes.data.result.download_url }, caption: "🎬 VIRUNA MD" }, { quoted: mek })
                    break

                case 'tts':
                    if (!q) return reply("වචනයක් දෙන්න.")
                    const ttsUrl = googleTTS.getAudioUrl(q, { lang: 'si', slow: false, host: 'https://translate.google.com' })
                    await conn.sendMessage(from, { audio: { url: ttsUrl }, mimetype: 'audio/mpeg', ptt: true }, { quoted: mek })
                    break

                case 'owner':
                    const vcard = 'BEGIN:VCARD\nVERSION:3.0\nFN:Viruna Randinu\nTEL;type=CELL;waid=94761138211:+94 76 113 8211\nEND:VCARD'
                    await conn.sendMessage(from, { contacts: { displayName: 'Viruna', contacts: [{ vcard }] } })
                    break
                
                case 'restart':
                    if (!sender.includes(ownerNumber)) return
                    await conn.sendMessage(from, { text: "🔄 Restarting..." })
                    process.exit()
                    break
            }
        } catch (e) { console.log(e) }
    })
}

app.get('/', (req, res) => res.send('VIRUNA MD Online'))
app.listen(port, () => startVirunaMD())