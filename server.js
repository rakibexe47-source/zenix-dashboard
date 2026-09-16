require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');
const crypto = require('crypto');
const os = require('os');

const app = express();
const PORT = Number(process.env.PORT || 3000);
const BOT_TOKEN = (process.env.DISCORD_BOT_TOKEN || '').trim();
const CLIENT_ID = (process.env.DISCORD_CLIENT_ID || '').trim();
const CLIENT_SECRET = (process.env.DISCORD_CLIENT_SECRET || '').trim();
const REDIRECT_URI = (process.env.DISCORD_REDIRECT_URI || '').trim();
const BOT_NAME = process.env.BOT_NAME || 'ZENIX';
const BOT_VERSION = process.env.BOT_VERSION || '1.8.0';
const BOT_PREFIX = process.env.BOT_PREFIX || '*';
const SUPPORT_URL = process.env.SUPPORT_URL || '#';
const YOUTUBE_URL = process.env.YOUTUBE_URL || 'https://www.youtube.com/@shido.code707';
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
const COOKIE_SECURE = String(process.env.COOKIE_SECURE || 'false').toLowerCase() === 'true';
const DISCORD_API = 'https://discord.com/api/v10';
const startedAt = Date.now();

if (!BOT_TOKEN || !CLIENT_ID || !CLIENT_SECRET || !REDIRECT_URI) {
  console.warn('[CONFIG] Set DISCORD_BOT_TOKEN, DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET and DISCORD_REDIRECT_URI in .env');
}

app.set('trust proxy', 1);
app.use(express.json({ limit: '32kb' }));
app.use(session({
  name: 'zenix.sid',
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: COOKIE_SECURE,
    maxAge: 7 * 24 * 60 * 60 * 1000
  }
}));
app.use(express.static(path.join(__dirname, 'public')));

function requireConfig(res) {
  const missing = [];
  if (!BOT_TOKEN) missing.push('DISCORD_BOT_TOKEN');
  if (!CLIENT_ID) missing.push('DISCORD_CLIENT_ID');
  if (!CLIENT_SECRET) missing.push('DISCORD_CLIENT_SECRET');
  if (!REDIRECT_URI) missing.push('DISCORD_REDIRECT_URI');
  if (missing.length) {
    res.status(503).json({ error: 'Dashboard is not configured.', missing });
    return false;
  }
  return true;
}

function discordOAuthUrl(state) {
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: 'identify guilds',
    state
  });
  return `https://discord.com/oauth2/authorize?${params.toString()}`;
}

async function discordFetch(url, options = {}) {
  const response = await fetch(`${DISCORD_API}${url}`, {
    ...options,
    headers: {
      'User-Agent': 'ZENIX-Dashboard/1.0',
      ...(options.headers || {})
    }
  });
  let body = null;
  try { body = await response.json(); } catch (_) {}
  if (!response.ok) {
    const err = new Error(body?.message || `Discord API ${response.status}`);
    err.status = response.status;
    throw err;
  }
  return body;
}

function isManager(guild) {
  const p = BigInt(guild.permissions || '0');
  return (p & 0x8n) !== 0n || (p & 0x20n) !== 0n;
}

function iconUrl(guild) {
  if (!guild.icon) return null;
  const ext = guild.icon.startsWith('a_') ? 'gif' : 'png';
  return `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.${ext}?size=128`;
}

async function getUserGuilds(accessToken) {
  return discordFetch('/users/@me/guilds?with_counts=true', {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
}

async function getBotGuilds() {
  return discordFetch('/users/@me/guilds?with_counts=true', {
    headers: { Authorization: `Bot ${BOT_TOKEN}` }
  });
}

async function getBotUser() {
  return discordFetch('/users/@me', {
    headers: { Authorization: `Bot ${BOT_TOKEN}` }
  });
}

function formatUptime(ms) {
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${d}d ${h}h ${m}m`;
}

function processStats() {
  const memory = process.memoryUsage();
  const total = os.totalmem();
  return {
    memory: Math.min(100, Math.round((memory.rss / total) * 100)),
    cpu: Math.min(100, Math.max(0, Math.round(os.loadavg()[0] / Math.max(os.cpus().length, 1) * 100))),
    node: process.version
  };
}

// ---- OAuth2 -------------------------------------------------------------
app.get('/auth/discord', (req, res) => {
  if (!requireConfig(res)) return;
  const state = crypto.randomBytes(24).toString('hex');
  req.session.oauthState = state;
  res.redirect(discordOAuthUrl(state));
});

app.get('/auth/discord/callback', async (req, res) => {
  if (!requireConfig(res)) return;
  const { code, state, error } = req.query;
  if (error) return res.redirect('/?login=cancelled');
  if (!code || !state || state !== req.session.oauthState) return res.status(400).send('Invalid OAuth state.');
  delete req.session.oauthState;

  try {
    const body = new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      grant_type: 'authorization_code',
      code: String(code),
      redirect_uri: REDIRECT_URI
    });
    const tokenResponse = await fetch(`${DISCORD_API}/oauth2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body
    });
    const token = await tokenResponse.json();
    if (!tokenResponse.ok) throw new Error(token.error_description || 'OAuth token exchange failed.');

    const user = await discordFetch('/users/@me', {
      headers: { Authorization: `Bearer ${token.access_token}` }
    });
    req.session.user = {
      id: user.id,
      username: user.username,
      global_name: user.global_name,
      avatar: user.avatar
    };
    req.session.accessToken = token.access_token;
    req.session.expiresAt = Date.now() + Number(token.expires_in || 604800) * 1000;
    res.redirect('/');
  } catch (err) {
    console.error('[OAuth]', err.message);
    res.redirect('/?login=error');
  }
});

app.post('/auth/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

// ---- Public API ---------------------------------------------------------
app.get('/api/session', (req, res) => {
  res.json({
    loggedIn: Boolean(req.session.user && req.session.accessToken),
    user: req.session.user || null,
    loginUrl: '/auth/discord'
  });
});

app.get('/api/stats', async (req, res) => {
  try {
    const [botUser, botGuilds] = await Promise.all([getBotUser(), getBotGuilds()]);
    const loggedIn = Boolean(req.session.user && req.session.accessToken);
    let userGuilds = [];
    if (loggedIn) userGuilds = await getUserGuilds(req.session.accessToken);

    const botIds = new Set(botGuilds.map(g => g.id));
    const managed = userGuilds.filter(isManager).map(g => ({
      id: g.id,
      name: g.name,
      icon: iconUrl(g),
      members: Number(g.approximate_member_count || g.member_count || 0),
      botPresent: botIds.has(g.id),
      canManage: true,
      permissions: g.permissions
    }));

    const totalMembers = botGuilds.reduce((sum, g) => sum + Number(g.approximate_member_count || g.member_count || 0), 0);
    const proc = processStats();
    res.json({
      botName: BOT_NAME,
      botVersion: BOT_VERSION,
      botPrefix: BOT_PREFIX,
      botStatus: 'online',
      botId: botUser.id,
      botAvatar: botUser.avatar ? `https://cdn.discordapp.com/avatars/${botUser.id}/${botUser.avatar}.png?size=256` : null,
      servers: botGuilds.length,
      members: totalMembers,
      uptime: formatUptime(Date.now() - startedAt),
      system: proc,
      dashboardUptime: formatUptime(Date.now() - startedAt),
      guilds: botGuilds.slice(0, 8).map(g => ({
        id: g.id,
        name: g.name,
        icon: iconUrl(g),
        members: Number(g.approximate_member_count || g.member_count || 0),
        status: 'online'
      })),
      manageableGuilds: managed,
      supportUrl: SUPPORT_URL,
      youtubeUrl: YOUTUBE_URL,
      loggedIn,
      user: req.session.user || null,
      logs: [
        { time: new Date().toLocaleTimeString('en-GB'), level: 'LIVE', msg: `Discord API connected · ${botGuilds.length} servers` },
        { time: new Date().toLocaleTimeString('en-GB'), level: 'LIVE', msg: `Bot identity loaded · ${botUser.username}` },
        { time: new Date().toLocaleTimeString('en-GB'), level: 'LIVE', msg: loggedIn ? `OAuth session active · ${managed.length} manageable servers` : 'Public mode · login to manage your servers' }
      ]
    });
  } catch (err) {
    console.error('[Stats]', err.message);
    res.status(err.status === 401 ? 503 : 500).json({ error: 'Could not load live Discord data.' });
  }
});

app.get('/api/servers', async (req, res) => {
  if (!req.session.accessToken) return res.status(401).json({ error: 'Login required.' });
  try {
    const [userGuilds, botGuilds] = await Promise.all([
      getUserGuilds(req.session.accessToken),
      getBotGuilds()
    ]);
    const botIds = new Set(botGuilds.map(g => g.id));
    const servers = userGuilds.filter(isManager).map(g => ({
      id: g.id,
      name: g.name,
      icon: iconUrl(g),
      members: Number(g.approximate_member_count || g.member_count || 0),
      botPresent: botIds.has(g.id),
      canManage: true,
      permissions: g.permissions
    }));
    res.json({ servers });
  } catch (err) {
    res.status(500).json({ error: 'Could not load your servers.' });
  }
});

app.get('/api/servers/:id', async (req, res) => {
  if (!req.session.accessToken) return res.status(401).json({ error: 'Login required.' });
  try {
    const guilds = await getUserGuilds(req.session.accessToken);
    const guild = guilds.find(g => g.id === req.params.id && isManager(g));
    if (!guild) return res.status(403).json({ error: 'You do not have permission to manage this server.' });
    const botGuilds = await getBotGuilds();
    const botPresent = botGuilds.some(g => g.id === guild.id);
    res.json({
      server: {
        id: guild.id,
        name: guild.name,
        icon: iconUrl(guild),
        members: Number(guild.approximate_member_count || guild.member_count || 0),
        botPresent,
        canManage: true,
        permissions: guild.permissions
      }
    });
  } catch (_) {
    res.status(500).json({ error: 'Could not load server.' });
  }
});

app.get('/api/invite', (req, res) => {
  if (!CLIENT_ID) return res.status(503).json({ error: 'DISCORD_CLIENT_ID is not configured.' });
  const permissions = process.env.BOT_INVITE_PERMISSIONS || '0';
  const url = `https://discord.com/oauth2/authorize?client_id=${encodeURIComponent(CLIENT_ID)}&permissions=${encodeURIComponent(permissions)}&scope=bot%20applications.commands`;
  res.json({ url });
});

app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.listen(PORT, () => console.log(`[ZENIX] Public dashboard running on port ${PORT}`));
