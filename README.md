# ZENIX Public Dashboard v2

This version is a real public dashboard, not a mock-data demo.

## What is live
- Discord OAuth2 login with CSRF state validation.
- Logged-in user's Discord servers are fetched from Discord.
- Only servers where the user has Administrator or Manage Server permission are shown.
- The dashboard checks which of those servers already contain ZENIX.
- ZENIX server/member counts come from Discord's bot account guild list.
- Bot identity/avatar comes from Discord.
- Invite URL is generated from the Discord application ID.
- Session cookies are HTTP-only and configurable for HTTPS.
- No hardcoded demo guild names or member counts.

## Required `.env`
Copy `.env.example` to `.env` and fill:

```env
DISCORD_CLIENT_ID=YOUR_APPLICATION_ID
DISCORD_CLIENT_SECRET=YOUR_CLIENT_SECRET
DISCORD_REDIRECT_URI=https://YOUR-DOMAIN.com/auth/discord/callback
DISCORD_BOT_TOKEN=YOUR_BOT_TOKEN
SESSION_SECRET=USE_A_LONG_RANDOM_SECRET
COOKIE_SECURE=true
```

Optional:
```env
BOT_INVITE_PERMISSIONS=0
SUPPORT_URL=https://discord.gg/YOUR_SUPPORT_SERVER
YOUTUBE_URL=https://www.youtube.com/@shido.code707
```

## Discord Developer Portal
In your ZENIX application, add this exact OAuth redirect URI:

`https://YOUR-DOMAIN.com/auth/discord/callback`

OAuth scopes used by the dashboard: `identify` and `guilds`.

## Run
```bash
npm install
npm start
```

## Important
The dashboard can verify that ZENIX is in a server, but server configuration changes are not silently faked. A separate authenticated bot-management API/bridge is required before buttons are allowed to change ZENIX settings.
