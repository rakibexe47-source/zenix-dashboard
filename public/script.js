const $ = id => document.getElementById(id);
const commands = [
 ['*help','General','Show the command help menu'],['*play <query>','Music','Play Spotify music through Lavalink'],['*247','Music','Toggle always-connected mode'],['*stop','Music','Stop playback without leaving voice'],['*leave','Music','Leave the voice channel'],['*kick <member>','Moderation','Kick a member'],['*ban <member>','Moderation','Ban a member'],['*mute <member>','Moderation','Mute a member'],['*warn <member>','Moderation','Warn a member'],['*purge <amount>','Moderation','Delete recent messages'],['*verify setup','Verification','Configure verification'],['*tempvc','TempVoice','Configure temporary voice channels'],['*avatar','Media','View a user avatar'],['*banner','Media','View a user or server banner'],['*servericon','Media','View the server icon'],['*custom avatar <url>','Custom Profile','Set the server-specific bot avatar'],['*custom banner <url>','Custom Profile','Set the server-specific bot banner'],['*setprefix <prefix>','Configuration','Change the server prefix']
];
let cachedData = null;
function fmt(n){return Number(n||0).toLocaleString('en-US')}
function avatarUrl(user){if(!user) return ''; return user.avatar ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=128` : `https://cdn.discordapp.com/embed/avatars/${Number(BigInt(user.id||'0')%5n)}.png`}
function toast(msg){$('toast').textContent=msg;$('toast').classList.add('show');setTimeout(()=>$('toast').classList.remove('show'),2800)}
function renderSession(s){
  $('loginBtn').hidden=s.loggedIn; $('userBox').hidden=!s.loggedIn;
  if(s.loggedIn){$('userAvatar').src=avatarUrl(s.user);$('userName').textContent=s.user.global_name||s.user.username}
}
function renderGuilds(guilds, target){
  target.innerHTML='';
  if(!guilds?.length){target.innerHTML='<div class="empty">No manageable servers found. Make sure you have Manage Server or Administrator.</div>';return}
  guilds.forEach(g=>{const el=document.createElement('div');el.className='guild';el.innerHTML=`<img src="${g.icon||'/favicon.ico'}" onerror="this.style.visibility='hidden'"><div><b>${escapeHtml(g.name)}</b><small>${fmt(g.members)} members</small></div><span class="guild-action ${g.botPresent?'manage':'add'}">${g.botPresent?'Manage':'Add ZENIX'}</span>`;el.onclick=()=>{if(g.botPresent) toast(`Selected ${g.name} — management API can be connected here.`);else if(cachedData?.inviteUrl) location.href=cachedData.inviteUrl};target.appendChild(el)})
}
function render(data){
  cachedData=data; $('servers').textContent=fmt(data.servers);$('members').textContent=fmt(data.members);$('uptime').textContent=data.dashboardUptime;$('status').textContent='● Online';$('statusNote').textContent='Discord API reachable';$('versionTag').textContent=`v${data.botVersion}`;$('heroStatus').textContent='ONLINE';
  const av=data.botAvatar || '/zenix-avatar.png'; ['sideAvatar','heroAvatar','aboutAvatar','quoteAvatar'].forEach(id=>$(id).src=av);
  $('guildList').innerHTML='';
  if(!data.loggedIn){$('guildList').innerHTML='<div class="login-box"><b>Login with Discord</b><span>Sign in to view the servers you can manage.</span><a href="/auth/discord">Continue with Discord →</a></div>'}
  else renderGuilds(data.manageableGuilds,$('guildList'));
  renderGuilds(data.manageableGuilds,$('allServers'));
  $('runtime').innerHTML=`<div class="bar"><span>CPU Load</span><b>${data.system.cpu}%</b><i><em style="width:${data.system.cpu}%"></em></i></div><div class="bar"><span>Memory</span><b>${data.system.memory}%</b><i><em style="width:${data.system.memory}%"></em></i></div><div class="bar"><span>Node.js</span><b>${escapeHtml(data.system.node)}</b><i><em style="width:100%"></em></i></div>`;
  $('logs').innerHTML=data.logs.map(x=>`<div><time>${x.time}</time><b>[${x.level}]</b><span>${escapeHtml(x.msg)}</span></div>`).join('');
  $('supportBtn').href=data.supportUrl||'#';$('youtubeBtn').href=data.youtubeUrl||'#';
  fetch('/api/invite').then(r=>r.json()).then(x=>{cachedData.inviteUrl=x.url; $('inviteBtn').href=x.url}).catch(()=>{});
  $('statusLarge').textContent='Online';$('statusDetail').textContent=`${data.botName} is reachable through Discord. ${fmt(data.servers)} servers detected.`;
}
function escapeHtml(s){return String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
async function load(){try{const s=await fetch('/api/session').then(r=>r.json());renderSession(s);const r=await fetch('/api/stats');const d=await r.json();if(!r.ok)throw new Error(d.error||'Failed');render(d)}catch(e){toast(e.message||'Could not load dashboard data');$('status').textContent='● Offline';$('statusNote').textContent='Check dashboard configuration'}}
function setupNav(){document.querySelectorAll('.nav').forEach(a=>a.addEventListener('click',e=>{e.preventDefault();show(a.dataset.section)}));window.addEventListener('hashchange',()=>show(location.hash.slice(1)||'home'));show(location.hash.slice(1)||'home')}
function show(id){document.querySelectorAll('.page').forEach(p=>p.classList.toggle('active-page',p.id===id));document.querySelectorAll('.nav').forEach(a=>a.classList.toggle('active',a.dataset.section===id));location.hash=id}
$('logoutBtn').onclick=async()=>{await fetch('/auth/logout',{method:'POST'});location.href='/'};
$('themeBtn').onclick=()=>document.body.classList.toggle('light');
$('search').oninput=e=>{const q=e.target.value.toLowerCase();document.querySelectorAll('#commandGrid article').forEach(x=>x.hidden=!x.textContent.toLowerCase().includes(q))};
$('commandGrid').innerHTML=commands.map(c=>`<article><b>${escapeHtml(c[0])}</b><small>${escapeHtml(c[1])}</small><p>${escapeHtml(c[2])}</p></article>`).join('');
setupNav();load();setInterval(load,30000);
