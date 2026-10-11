/* ShareBite front end: hash-routed single page app, no build step. */
const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let token = localStorage.getItem('sb_token');
let me = JSON.parse(localStorage.getItem('sb_user') || 'null');
let CATS = {};
const STATUS = { no_show: 'No-show' };
const label = (s) => STATUS[s] || s.charAt(0).toUpperCase() + s.slice(1);

async function api(path, { method = 'GET', body, form } = {}) {
  const headers = {};
  if (token) headers.Authorization = 'Bearer ' + token;
  let payload;
  if (form) payload = form;
  else if (body) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }
  const res = await fetch('/api' + path, { method, headers, body: payload });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && token) logout();
    throw new Error(data.error || 'Request failed');
  }
  return data;
}

function toast(msg, bad) {
  const t = $('#toast');
  t.textContent = msg; t.className = 'show' + (bad ? ' bad' : '');
  clearTimeout(toast.id); toast.id = setTimeout(() => (t.className = ''), 3500);
}
function setSession(data) {
  token = data.token; me = data.user;
  localStorage.setItem('sb_token', token); localStorage.setItem('sb_user', JSON.stringify(me));
}
function logout() {
  token = null; me = null; localStorage.removeItem('sb_token'); localStorage.removeItem('sb_user');
  location.hash = '#/login'; renderNav();
}

/* ---------- helpers ---------- */
function left(deadline) {
  const ms = new Date(deadline) - Date.now();
  if (ms <= 0) return 'Expired';
  const m = Math.floor(ms / 60000), h = Math.floor(m / 60);
  if (h >= 48) return Math.floor(h / 24) + ' days left';
  return (h ? `${h}h ${m % 60}m` : `${m}m`) + ' left';
}
const when = (d) => new Date(d).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
const localInput = (d) => { const x = new Date(d); x.setMinutes(x.getMinutes() - x.getTimezoneOffset()); return x.toISOString().slice(0, 16); };
const badge = (s) => `<span class="badge b-${esc(s)}">${esc(label(s))}</span>`;
const empty = (msg) => `<div class="empty">${msg}</div>`;

function dialog(title, inner, submit, handler) {
  const dlg = $('#dlg');
  dlg.innerHTML = `<form class="dform"><h2>${esc(title)}</h2>${inner}<p class="err" role="alert"></p>
    <div class="row end"><button type="button" class="ghost" data-close>Cancel</button><button class="primary">${esc(submit)}</button></div></form>`;
  dlg.showModal();
  $('[data-close]', dlg).onclick = () => dlg.close();
  $('form', dlg).onsubmit = async (e) => {
    e.preventDefault();
    try { await handler(new FormData(e.target)); dlg.close(); } catch (err) { $('.err', dlg).textContent = err.message; }
  };
}

/* ---------- navigation ---------- */
function renderNav() {
  const cur = location.hash || '#/';
  const link = (h, t, cls = '') => `<a href="${h}" class="${cls}" ${cur === h ? 'aria-current="page"' : ''}>${t}</a>`;
  let h = link('#/browse', 'Find food') + link('#/impact', 'Impact');
  if (me?.role === 'donor') h += link('#/post', 'Donate food') + link('#/dashboard', 'My dashboard');
  if (me?.role === 'recipient') h += link('#/dashboard', 'My requests');
  if (me?.role === 'admin') h += link('#/admin', 'Admin');
  h += me
    ? `<a href="#/login" data-act="logout">Log out (${esc(me.name.split(' ')[0])})</a>`
    : link('#/login', 'Log in') + link('#/register', 'Sign up', 'cta');
  $('#nav').innerHTML = h;
}
$('#menuBtn').onclick = () => { const n = $('#nav'); n.classList.toggle('open'); $('#menuBtn').setAttribute('aria-expanded', n.classList.contains('open')); };

/* ---------- listing card ---------- */
function card(d) {
  const pct = Math.round((d.reservedQty / d.quantity) * 100);
  const urgent = new Date(d.collectionDeadline) - Date.now() < 2 * 3600000;
  let action = badge(d.status);
  if (d.status === 'available') {
    action = me?.role === 'recipient'
      ? `<button class="primary sm" data-act="request" data-id="${d._id}" data-max="${d.remaining}" data-name="${esc(d.foodName)}">Request</button>`
      : !me ? `<a class="btn sm" href="#/login">Log in to request</a>` : '';
  }
  const thumb = d.imageUrl
    ? `<img src="${esc(d.imageUrl)}" alt="${esc(d.foodName)}" loading="lazy">`
    : esc(CATS[d.category]?.label || '');
  return `<article class="card">
    <div class="thumb ${d.imageUrl ? '' : 'cat-' + esc(d.category)}">${thumb}</div>
    <div class="body"><h3>${esc(d.foodName)}</h3>
      <p class="muted">${esc(d.donor?.organization || d.donor?.name || '')}</p>
      <p>${esc(d.pickupLocation)}</p>
      ${d.description ? `<p class="muted">${esc(d.description)}</p>` : ''}
      <div class="meter"><span style="width:${pct}%"></span></div>
      <p><b>${d.remaining}</b> of ${d.quantity} ${esc(d.unit)} left</p></div>
    <div class="stub ${urgent ? 'urgent' : ''}"><span class="left" data-t="${d.collectionDeadline}">${left(d.collectionDeadline)}</span>${action}</div>
  </article>`;
}

/* ---------- views ---------- */
const views = {
  async home() {
    const [s, list] = await Promise.all([api('/stats'), api('/donations?status=available')]);
    $('#app').innerHTML = `
      <section class="hero">
        <div>
          <h1>Good food, collected before it goes to waste.</h1>
          <p class="lead">Canteens, caterers and bakeries list what is left over. Verified NGOs claim it and pick it up before the deadline.</p>
          <div class="row">
            <a class="btn primary" href="#/browse">Find food</a>
            ${me ? '' : '<a class="btn" href="#/register">Donate surplus food</a>'}
          </div>
        </div>
        <div class="board"><h2>Closing soonest</h2>
          ${list.slice(0, 4).map((d) => `<a class="board-row" href="#/browse"><span>${esc(d.foodName)}</span>
            <small>${d.remaining} ${esc(d.unit)}, ${esc(d.donor?.organization || d.donor?.name || '')}</small>
            <span class="left" data-t="${d.collectionDeadline}">${left(d.collectionDeadline)}</span></a>`).join('') || '<p class="muted">Nothing is listed right now.</p>'}
        </div>
      </section>
      <div class="statline">
        <div><b>${s.mealsRedistributed}</b>portions redistributed</div>
        <div><b>${s.completedPickups}</b>pickups completed</div>
        <div><b>${s.activeListings}</b>listings open now</div>
        <div><b>${s.recipients}</b>verified NGOs</div>
      </div>
      <h2>How it works</h2>
      <ol class="steps">
        <li><h3>Donors list surplus food</h3><p>Add quantity, pickup place and a collection deadline.</p></li>
        <li><h3>Verified NGOs request it</h3><p>The donor accepts and sets a pickup time.</p></li>
        <li><h3>Food is collected</h3><p>The donor marks it collected and the impact numbers update.</p></li>
      </ol>`;
  },

  async browse() {
    $('#app').innerHTML = `<h1>Find food</h1>
      <p class="muted">Expired food is removed automatically. Only active listings show here.</p>
      <form class="filters" id="filters">
        <label>Search<input name="search" placeholder="Rice, bread, biryani"></label>
        <label>Type<select name="category"><option value="">All types</option>
          ${Object.entries(CATS).map(([k, v]) => `<option value="${k}">${esc(v.label)}</option>`).join('')}</select></label>
        <label>Location<input name="location" placeholder="Area or town"></label>
        <label>Min. quantity<input name="minQty" type="number" min="1"></label>
        <label>Status<select name="status"><option value="">Available and reserved</option><option value="available">Available</option><option value="reserved">Reserved</option></select></label>
      </form><div id="results" class="grid"></div>`;
    const load = async () => {
      const q = new URLSearchParams([...new FormData($('#filters'))].filter(([, v]) => v));
      const list = await api('/donations?' + q);
      $('#results').innerHTML = list.map(card).join('') || empty('No listings match. Try clearing a filter.');
    };
    let timer; $('#filters').oninput = () => { clearTimeout(timer); timer = setTimeout(() => load().catch((e) => toast(e.message, 1)), 250); };
    $('#filters').onsubmit = (e) => e.preventDefault();
    await load();
  },

  login() {
    $('#app').innerHTML = `<div class="panel form-card"><h1>Log in</h1>
      <form id="f"><label>Email<input name="email" type="email" required autocomplete="username"></label>
      <label>Password<input name="password" type="password" required autocomplete="current-password"></label>
      <p class="err" role="alert"></p><button class="primary">Log in</button></form>
      <p class="muted" style="margin-top:1rem">New here? <a href="#/register">Create an account</a></p></div>`;
    $('#f').onsubmit = async (e) => {
      e.preventDefault();
      try { setSession(await api('/auth/login', { method: 'POST', body: Object.fromEntries(new FormData(e.target)) })); location.hash = me.role === 'admin' ? '#/admin' : '#/dashboard'; renderNav(); }
      catch (err) { $('.err').textContent = err.message; }
    };
  },

  register() {
    $('#app').innerHTML = `<div class="panel form-card"><h1>Create an account</h1>
      <form id="f"><label>I want to<select name="role"><option value="donor">Donate surplus food</option><option value="recipient">Collect food for an NGO or shelter</option></select></label>
      <div class="two"><label>Your name<input name="name" required></label>
      <label>Organization<input name="organization" placeholder="Canteen, bakery, NGO"></label></div>
      <div class="two"><label>Email<input name="email" type="email" required autocomplete="username"></label>
      <label>Phone<input name="phone" type="tel"></label></div>
      <label>Password<input name="password" type="password" minlength="8" required autocomplete="new-password"><span class="hint">At least 8 characters</span></label>
      <p class="hint" id="note">NGO accounts are checked by an admin before they can request food.</p>
      <p class="err" role="alert"></p><button class="primary">Sign up</button></form></div>`;
    $('#f').onsubmit = async (e) => {
      e.preventDefault();
      try { setSession(await api('/auth/register', { method: 'POST', body: Object.fromEntries(new FormData(e.target)) })); location.hash = '#/dashboard'; renderNav(); }
      catch (err) { $('.err').textContent = err.message; }
    };
  },

  async post(id) {
    if (me?.role !== 'donor') return (location.hash = '#/login');
    const d = id ? await api('/donations/' + id) : {};
    const v = (k, def = '') => esc(d[k] ?? def);
    $('#app').innerHTML = `<div class="panel form-card"><h1>${id ? 'Edit listing' : 'Donate food'}</h1>
      <form id="f">
        <label>Food name<input name="foodName" value="${v('foodName')}" required minlength="3"></label>
        <label>Details<textarea name="description" rows="2" placeholder="Ingredients, how it is packed, when it was made">${v('description')}</textarea></label>
        <div class="two"><label>Quantity<input name="quantity" type="number" min="1" max="5000" value="${v('quantity')}" required></label>
        <label>Unit<input name="unit" value="${v('unit', 'packets')}" required></label></div>
        <label>Food type<select name="category" id="cat" required>
          ${Object.entries(CATS).map(([k, c]) => `<option value="${k}" ${d.category === k ? 'selected' : ''}>${esc(c.label)}</option>`).join('')}</select>
          <span class="hint" id="catHint"></span></label>
        <label>Pickup location<input name="pickupLocation" value="${v('pickupLocation')}" required minlength="5" placeholder="Building, street, town"></label>
        <label>Collect before<input name="collectionDeadline" type="datetime-local" required value="${d.collectionDeadline ? localInput(d.collectionDeadline) : ''}"></label>
        <label>Photo (JPG, PNG or WebP, up to 2 MB)<input name="image" type="file" accept="image/jpeg,image/png,image/webp"></label>
        <label class="check"><input type="checkbox" name="safetyConfirmed" ${d.safetyConfirmed ? 'checked' : ''}>
          <span>I confirm this food is fresh, safely stored, not previously served from a plate, and fit to eat.</span></label>
        <p class="err" role="alert"></p>
        <button class="primary">${id ? 'Save changes' : 'Publish listing'}</button></form></div>`;
    const hint = () => ($('#catHint').textContent = `Can be listed for up to ${CATS[$('#cat').value].maxHours} hours.`);
    $('#cat').onchange = hint; hint();
    $('#f').onsubmit = async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      fd.set('safetyConfirmed', e.target.safetyConfirmed.checked);
      const dl = fd.get('collectionDeadline');
      fd.set('collectionDeadline', dl ? new Date(dl).toISOString() : '');
      try {
        await api('/donations' + (id ? '/' + id : ''), { method: id ? 'PUT' : 'POST', form: fd });
        toast(id ? 'Listing updated' : 'Listing published'); location.hash = '#/dashboard';
      } catch (err) { $('.err').textContent = err.message; }
    };
  },

  async dashboard() {
    if (!me) return (location.hash = '#/login');
    if (me.role === 'admin') return (location.hash = '#/admin');
    const mine = await api('/stats/me');
    const tiles = me.role === 'donor'
      ? `<div><b>${mine.listed}</b>listings posted</div><div><b>${mine.pickups}</b>pickups completed</div><div><b>${mine.quantity}</b>portions given</div>`
      : `<div><b>${mine.pickups}</b>pickups completed</div><div><b>${mine.quantity}</b>portions received</div>`;
    const head = `<h1>${me.role === 'donor' ? 'Your dashboard' : 'Your requests'}</h1><div class="mini">${tiles}</div>`;
    if (me.role === 'donor') {
      const [list, incoming] = await Promise.all([api('/donations/mine'), api('/requests/incoming')]);
      $('#app').innerHTML = head + `<h2>Requests on your food</h2><div class="panel tablewrap">${incoming.length ? `<table>
        <tr><th>Food</th><th>From</th><th>Quantity</th><th>Status</th><th>Pickup</th><th></th></tr>
        ${incoming.map((r) => `<tr><td>${esc(r.donation?.foodName)}</td>
          <td>${esc(r.requester?.organization || r.requester?.name)}<br><span class="muted">${esc(r.requester?.phone)}</span>${r.message ? `<br><span class="muted">${esc(r.message)}</span>` : ''}</td>
          <td>${r.quantity} ${esc(r.donation?.unit)}</td><td>${badge(r.status)}</td>
          <td>${r.pickup ? when(r.pickup.pickupTime) : ''}</td>
          <td class="row">${r.status === 'pending' ? `<button class="primary sm" data-act="accept" data-id="${r._id}" data-deadline="${r.donation?.collectionDeadline}">Accept</button><button class="sm danger" data-act="reject" data-id="${r._id}">Reject</button>` : ''}
          ${r.status === 'accepted' ? `<button class="primary sm" data-act="complete" data-id="${r._id}">Mark collected</button><button class="sm danger" data-act="noshow" data-id="${r._id}">No-show</button>` : ''}</td></tr>`).join('')}</table>` : empty('No requests yet.')}</div>
        <div class="row" style="justify-content:space-between"><h2>Your listings</h2><a class="btn primary" href="#/post">New listing</a></div>
        <div class="panel tablewrap">${list.length ? `<table><tr><th>Food</th><th>Left</th><th>Status</th><th>Collect before</th><th></th></tr>
        ${list.map((d) => `<tr><td>${esc(d.foodName)}</td><td>${d.remaining} of ${d.quantity} ${esc(d.unit)}</td><td>${badge(d.status)}</td><td>${when(d.collectionDeadline)}</td>
          <td class="row">${['available', 'reserved'].includes(d.status) ? `<a class="btn sm" href="#/post/${d._id}">Edit</a><button class="sm danger" data-act="remove" data-id="${d._id}">Remove</button>` : ''}</td></tr>`).join('')}</table>` : empty('You have not listed any food yet.')}</div>`;
    } else {
      const reqs = await api('/requests/mine');
      $('#app').innerHTML = head
        + (me.verified ? '' : '<div class="notice">Your organization is waiting for admin verification. You can browse food, but requests unlock once you are verified.</div>')
        + `<div class="panel tablewrap">${reqs.length ? `<table><tr><th>Food</th><th>Donor</th><th>Quantity</th><th>Status</th><th>Pickup</th><th></th></tr>
        ${reqs.map((r) => `<tr><td>${esc(r.donation?.foodName)}<br><span class="muted">${esc(r.donation?.pickupLocation)}</span></td>
          <td>${esc(r.donation?.donor?.organization || r.donation?.donor?.name)}${r.status === 'accepted' ? `<br><span class="muted">${esc(r.donation?.donor?.phone)}</span>` : ''}</td>
          <td>${r.quantity} ${esc(r.donation?.unit)}</td><td>${badge(r.status)}</td><td>${r.pickup ? when(r.pickup.pickupTime) : ''}</td>
          <td class="row">${['pending', 'accepted'].includes(r.status) ? `<button class="sm danger" data-act="cancel" data-id="${r._id}">Cancel</button>` : ''}
          ${r.status === 'completed' && !r.rated ? `<button class="sm" data-act="rate" data-id="${r._id}">Rate</button>` : ''}</td></tr>`).join('')}</table>` : empty('You have not requested any food yet. <a href="#/browse">Find food</a>')}</div>`;
    }
  },

  async impact() {
    const s = await api('/stats');
    $('#app').innerHTML = `<h1>Impact</h1>
      <div class="mini"><div><b>${s.mealsRedistributed}</b>portions redistributed</div><div><b>${s.completedPickups}</b>completed pickups</div>
      <div><b>${s.totalDonations}</b>donations listed</div><div><b>${s.donors}</b>donors</div></div>
      <h2>Top donors</h2><div class="panel">${s.topDonors.length ? `<table><tr><th>Donor</th><th>Portions</th><th>Pickups</th></tr>
      ${s.topDonors.map((t) => `<tr><td>${esc(t.name)}</td><td>${t.qty}</td><td>${t.pickups}</td></tr>`).join('')}</table>` : empty('Completed pickups will appear here.')}</div>`;
  },

  async admin() {
    if (me?.role !== 'admin') return (location.hash = '#/login');
    const [users, list] = await Promise.all([api('/admin/users'), api('/admin/donations')]);
    $('#app').innerHTML = `<h1>Admin</h1><h2>Accounts</h2><div class="panel tablewrap"><table>
      <tr><th>Name</th><th>Role</th><th>Contact</th><th>Verified</th><th></th></tr>
      ${users.map((u) => `<tr><td>${esc(u.organization || u.name)}<br><span class="muted">${esc(u.email)}</span></td><td>${esc(u.role)}</td><td>${esc(u.phone)}</td>
        <td>${u.role === 'recipient' ? `<span class="badge b-${u.verified ? 'accepted' : 'pending'}">${u.verified ? 'Verified' : 'Waiting'}</span>` : ''}</td>
        <td>${u.role === 'recipient' ? `<button class="sm" data-act="verify" data-id="${u._id}" data-v="${!u.verified}">${u.verified ? 'Revoke' : 'Verify'}</button>` : ''}</td></tr>`).join('')}</table></div>
      <h2>All listings</h2><div class="panel tablewrap"><table><tr><th>Food</th><th>Donor</th><th>Status</th><th>Collect before</th><th></th></tr>
      ${list.map((d) => `<tr><td>${esc(d.foodName)}</td><td>${esc(d.donor?.organization || d.donor?.name)}</td><td>${badge(d.status)}</td><td>${when(d.collectionDeadline)}</td>
        <td>${['available', 'reserved'].includes(d.status) ? `<button class="sm danger" data-act="adminremove" data-id="${d._id}">Remove</button>` : ''}</td></tr>`).join('')}</table></div>`;
  },
};

/* ---------- actions (buttons with data-act) ---------- */
const patch = (path, msg) => api(path, { method: 'PATCH', body: {} }).then(() => { toast(msg); route(); });
const acts = {
  logout: () => logout(),
  request: (d) => dialog(`Request ${d.name}`,
    `<label>Quantity (up to ${d.max})<input name="quantity" type="number" min="1" max="${d.max}" value="${d.max}" required></label>
     <label>Message to donor<textarea name="message" rows="2" placeholder="When can you collect?"></textarea></label>`, 'Send request',
    async (f) => { await api('/requests', { method: 'POST', body: { donationId: d.id, quantity: f.get('quantity'), message: f.get('message') } }); toast('Request sent'); location.hash = '#/dashboard'; }),
  accept: (d) => dialog('Accept request',
    `<label>Pickup time<input name="t" type="datetime-local" required min="${localInput(Date.now())}" max="${localInput(d.deadline)}" value="${localInput(Math.min(Date.now() + 3600000, new Date(d.deadline)))}"></label>
     <p class="hint">Must be before the collection deadline.</p>`, 'Accept',
    async (f) => { await api(`/requests/${d.id}/accept`, { method: 'PATCH', body: { pickupTime: new Date(f.get('t')).toISOString() } }); toast('Request accepted'); route(); }),
  reject: (d) => patch(`/requests/${d.id}/reject`, 'Request rejected'),
  complete: (d) => patch(`/requests/${d.id}/complete`, 'Marked as collected'),
  noshow: (d) => patch(`/requests/${d.id}/no-show`, 'Marked as no-show. Food is available again'),
  cancel: (d) => confirm('Cancel this request?') && patch(`/requests/${d.id}/cancel`, 'Request cancelled'),
  remove: (d) => confirm('Remove this listing? Open requests will be cancelled.') && api('/donations/' + d.id, { method: 'DELETE' }).then(() => { toast('Listing removed'); route(); }),
  adminremove: (d) => confirm('Remove this listing?') && api('/admin/donations/' + d.id, { method: 'DELETE' }).then(() => { toast('Listing removed'); route(); }),
  verify: (d) => api(`/admin/users/${d.id}/verify`, { method: 'PATCH', body: { verified: d.v === 'true' } }).then(() => { toast('Account updated'); route(); }),
  rate: (d) => dialog('Rate this donation',
    `<label>Rating<select name="rating"><option value="5">5 - Excellent</option><option value="4">4 - Good</option><option value="3">3 - Okay</option><option value="2">2 - Poor</option><option value="1">1 - Unsafe or unusable</option></select></label>
     <label>Comments<textarea name="comments" rows="2"></textarea></label>`, 'Send feedback',
    async (f) => { await api('/feedback', { method: 'POST', body: { requestId: d.id, rating: f.get('rating'), comments: f.get('comments') } }); toast('Thanks for the feedback'); route(); }),
};
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-act]');
  if (!b || !acts[b.dataset.act]) return;
  if (b.dataset.act !== 'logout') e.preventDefault();
  Promise.resolve(acts[b.dataset.act](b.dataset)).catch((err) => toast(err.message, true));
});

/* ---------- router ---------- */
async function route() {
  const [, name = 'home', id] = (location.hash || '#/').slice(1).split('/');
  renderNav(); $('#nav').classList.remove('open');
  const view = views[name || 'home'] || views.home;
  try { await view(id); } catch (err) { $('#app').innerHTML = empty(esc(err.message)); }
}
window.addEventListener('hashchange', () => { route(); window.scrollTo(0, 0); $('#app').focus({ preventScroll: true }); });
setInterval(() => document.querySelectorAll('[data-t]').forEach((el) => (el.textContent = left(el.dataset.t))), 30000);

(async () => {
  try { CATS = await api('/donations/categories'); } catch { /* server may be down */ }
  if (token) api('/auth/me').then((r) => { me = r.user; localStorage.setItem('sb_user', JSON.stringify(me)); renderNav(); }).catch(() => {});
  route();
})();
