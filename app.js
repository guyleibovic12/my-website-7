const $ = (sel, el=document)=> el.querySelector(sel);
const $$ = (sel, el=document)=> Array.from(el.querySelectorAll(sel));

const routes = {
  '/dashboard': renderDashboard,
  '/calendar': renderCalendar,
  '/activities': renderActivities,
  '/tasks': renderTasks,
  '/shopping': renderShopping,
  '/messages': renderMessages,
  '/members': renderMembers,
  '/settings': renderSettings,
};

function router(){
  const hash = location.hash || '#/dashboard';
  const path = hash.replace('#','');
  const view = routes[path] || renderDashboard;
  const tabs = $('#tabs');
  if(tabs) $$('#tabs a').forEach(a=> a.classList.toggle('active', a.getAttribute('href')===hash));
  if(window.cloud && cloud.data){
    view();
  }else{
    $('#app').innerHTML = `<div class="card"><h3>טוען…</h3><p class="muted">מתחבר לענן…</p></div>`;
  }
}

window.addEventListener('hashchange', router);
window.addEventListener('load', async ()=>{
  setupInstall();
  await cloud.requireAuth();
  router();
});

function card(title, body, extra=''){
  return `<div class="card">
    <div class="section-title">
      <h3>${title}</h3>
      ${extra}
    </div>
    ${body}
  </div>`;
}

function empty(msg){ return `<p class="muted">${msg}</p>`; }

function renderDashboard(){
  const app = $('#app');
  const s = cloud.data;
  const today = new Date().toISOString().slice(0,10);
  const todaysEvents = s.events.filter(e=>e.date===today);
  const openTasks = s.tasks.filter(t=>!t.done).slice(0,5);
  const list = (items, map)=> items.length? `<div class="list">${items.map(map).join('')}</div>` : empty('אין פריטים.');
  app.innerHTML = `
    <div class="grid">
      ${card('היום', list(todaysEvents, e=>`<div class="item"><strong>${e.title}</strong><small>${e.who||''}</small></div>`), `<span class="badge">${today}</span>`)}
      ${card('משימות פתוחות', list(openTasks, t=>`<div class="item"><input type="checkbox" onchange="toggleTask('${t.id}')" ${t.done?'checked':''}><div>${t.text}<br><small class="muted">${t.who||''}</small></div></div>`), `<a class="badge" href="#/tasks">לכל המשימות</a>`)}
      ${card('רשימת קניות', list(s.shopping.slice(0,5), x=>`<div class="item"><input type="checkbox" onchange="toggleShopping('${x.id}')" ${x.done?'checked':''}><div>${x.text} <small class="muted">×${x.qty||1}</small></div></div>`), `<a class="badge" href="#/shopping">לרשימה</a>`)}
      ${card('חוגים', list(s.activities.slice(0,5), a=>`<div class="item"><div><strong>${a.title}</strong><br><small class="muted">${a.child} • ${a.day} • ${a.time}</small></div></div>`), `<a class="badge" href="#/activities">לכל החוגים</a>`)}
      ${card('הודעות אחרונות', list(s.messages.slice(-5).reverse(), m=>`<div class="item"><div><strong>${m.from}</strong><br><small class="muted">${new Date(m.ts).toLocaleString('he-IL')}</small><div>${m.text}</div></div></div>`), `<a class="badge" href="#/messages">פתח</a>`)}
    </div>
  `;
}

function renderCalendar(){
  const app = $('#app');
  const s = cloud.data;
  const today = new Date();
  const daysInMonth = new Date(today.getFullYear(), today.getMonth()+1, 0).getDate();
  const cells = [];
  for (let d=1; d<=daysInMonth; d++){
    const dateStr = new Date(today.getFullYear(), today.getMonth(), d).toISOString().slice(0,10);
    const items = s.events.filter(e=>e.date===dateStr);
    cells.push(`<div class="day">
      <div class="chips"><span class="chip">${dateStr}</span></div>
      ${items.map(e=>`<div class="item"><div>${e.title}<br><small class="muted">${e.who||''}</small></div>
      <div class="actions"><button class="danger" onclick="removeEvent('${e.id}')">מחק</button></div></div>`).join('') || `<div class="muted">—</div>`}
      <div class="row" style="margin-top:.4rem">
        <input placeholder="כותרת" id="t_${dateStr}">
        <select id="w_${dateStr}">
          ${s.members.map(m=>`<option>${m.name}</option>`).join('')}
        </select>
        <button class="ok" onclick="addEvent('${dateStr}')">+</button>
      </div>
    </div>`);
  }
  app.innerHTML = `${card('יומן חודשי', `<div class="calendar">${cells.join('')}</div>`, `<span class="badge pill">${today.toLocaleDateString('he-IL',{month:'long', year:'numeric'})}</span>`)}`;
}

function renderActivities(){
  const app = $('#app');
  const s = cloud.data;
  const list = s.activities.map(a=>`<div class="item">
    <div><strong>${a.title}</strong><br><small class="muted">${a.child} • ${a.day} • ${a.time} • ${a.place||''}</small></div>
    <div class="actions"><button class="danger" onclick="removeActivity('${a.id}')">מחק</button></div>
  </div>`).join('') || empty('אין חוגים עדיין.');
  app.innerHTML = `
    ${card('חוגים', `<div class="list">${list}</div>`)}
    ${card('הוספת חוג', `
      <div class="row"><input id="a_title" placeholder="שם החוג"><input id="a_child" placeholder="שם הילד/ה"></div>
      <div class="row"><select id="a_day">
        ${['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת'].map(d=>`<option>${d}</option>`).join('')}
      </select><input id="a_time" type="time" value="16:00"></div>
      <input id="a_place" placeholder="מיקום (רשות)">
      <button class="primary" onclick="addActivity()">הוסף</button>
    `)}
  `;
}

function renderTasks(){
  const app = $('#app');
  const s = cloud.data;
  const list = s.tasks.map(t=>`<div class="item">
    <input type="checkbox" onchange="toggleTask('${t.id}')" ${t.done?'checked':''}>
    <div>${t.text}<br><small class="muted">${t.who||''}</small></div>
    <div class="actions"><button class="danger" onclick="removeTask('${t.id}')">מחק</button></div>
  </div>`).join('') || empty('אין משימות.');
  app.innerHTML = `
    ${card('משימות', `<div class="list">${list}</div>`)}
    ${card('משימה חדשה', `
      <div class="row"><input id="task_text" placeholder="מה צריך לעשות?"><select id="task_who">
        <option value="">—</option>
        ${s.members.map(m=>`<option>${m.name}</option>`).join('')}
      </select></div>
      <button class="primary" onclick="addTask()">הוסף</button>
    `)}
  `;
}

function renderShopping(){
  const app = $('#app');
  const s = cloud.data;
  const list = s.shopping.map(x=>`<div class="item">
    <input type="checkbox" onchange="toggleShopping('${x.id}')" ${x.done?'checked':''}>
    <div>${x.text} <small class="muted">×${x.qty||1}</small></div>
    <div class="actions"><button class="danger" onclick="removeShopping('${x.id}')">מחק</button></div>
  </div>`).join('') || empty('הרשימה ריקה.');
  app.innerHTML = `
    ${card('רשימת קניות', `<div class="list">${list}</div>`)}
    ${card('הוספה', `
      <div class="row"><input id="s_text" placeholder="מוצר"><input id="s_qty" type="number" value="1" min="1"></div>
      <button class="primary" onclick="addShopping()">הוסף</button>
    `)}
  `;
}

function renderMessages(){
  const app = $('#app');
  const s = cloud.data;
  const list = s.messages.slice().reverse().map(m=>`<div class="item">
    <div><strong>${m.from}</strong> <small class="muted">${new Date(m.ts).toLocaleString('he-IL')}</small><div>${m.text}</div></div>
  </div>`).join('') || empty('אין הודעות.');
  app.innerHTML = `
    ${card('שיחה משפחתית', `<div class="list" id="msg_list">${list}</div>`)}
    ${card('שליחת הודעה', `
      <div class="row"><select id="msg_from">
        ${s.members.map(m=>`<option>${m.name}</option>`).join('')}
      </select><input id="msg_text" placeholder="כתוב הודעה..."></div>
      <button class="primary" onclick="addMessage()">שלח</button>
    `)}
  `;
}

function renderMembers(){
  const app = $('#app');
  const s = cloud.data;
  const list = s.members.map(m=>`<div class="item">
    <div class="badge" style="background:${m.color};color:#000">${m.name}</div>
    <div class="actions"><button class="danger" onclick="removeMember('${m.id}')">מחק</button></div>
  </div>`).join('') || empty('לא הוגדרו בני משפחה.');
  app.innerHTML = `
    ${card('בני משפחה', `<div class="list">${list}</div>`, `<span class="badge pill">ללא הגבלה</span>`)}
    ${card('הוספת בן/בת משפחה', `
      <div class="row"><input id="m_name" placeholder="שם"><input id="m_color" type="color" value="#2F80ED"></div>
      <button class="primary" onclick="addMember()">הוסף</button>
    `)}
  `;
}

function renderSettings(){
  const app = $('#app');
  const s = cloud.data;
  app.innerHTML = `
    ${card('הגדרות', `
      <label>שם המשפחה</label>
      <input id="fam_name" value="${s.familyName||''}" oninput="updateSettingsName(this.value)">
      <div class="row">
        <button class="danger" onclick="signOut()">התנתקות</button>
      </div>
      <div class="muted">סנכרון אוטומטי לכל המכשירים המחוברים.</div>
    `)}
  `;
}

// פעולות — שינוי state ושמירה לענן
function save(){ cloud.save(cloud.data); }

function updateSettingsName(v){ cloud.data.familyName = v; save(); }

function addTask(){
  const text = $('#task_text').value.trim();
  const who = $('#task_who').value;
  if(!text) return;
  cloud.data.tasks.push({id: crypto.randomUUID(), text, who, done:false});
  save();
}
function toggleTask(id){
  const t = cloud.data.tasks.find(x=>x.id===id);
  if(!t) return; t.done=!t.done; save();
}
function removeTask(id){
  cloud.data.tasks = cloud.data.tasks.filter(x=>x.id!==id); save();
}

function addShopping(){
  const text = $('#s_text').value.trim();
  const qty = $('#s_qty').value || '1';
  if(!text) return;
  cloud.data.shopping.push({id: crypto.randomUUID(), text, qty, done:false}); save();
}
function toggleShopping(id){
  const s = cloud.data.shopping.find(x=>x.id===id);
  if(!s) return; s.done=!s.done; save();
}
function removeShopping(id){
  cloud.data.shopping = cloud.data.shopping.filter(x=>x.id!==id); save();
}

function addActivity(){
  const title = $('#a_title').value.trim();
  const child = $('#a_child').value.trim();
  const day = $('#a_day').value;
  const time = $('#a_time').value;
  const place = $('#a_place').value.trim();
  if(!title || !child) return;
  cloud.data.activities.push({id: crypto.randomUUID(), title, child, day, time, place}); save();
}
function removeActivity(id){
  cloud.data.activities = cloud.data.activities.filter(x=>x.id!==id); save();
}

function addEvent(date){
  const t = $(`#t_${date}`).value.trim();
  const w = $(`#w_${date}`).value;
  if(!t) return;
  cloud.data.events.push({id: crypto.randomUUID(), date, title:t, who:w}); save();
}
function removeEvent(id){
  cloud.data.events = cloud.data.events.filter(x=>x.id!==id); save();
}

function addMessage(){
  const from = $('#msg_from').value;
  const text = $('#msg_text').value.trim();
  if(!text) return;
  cloud.data.messages.push({id: crypto.randomUUID(), from, text, ts: Date.now()}); save();
}

function addMember(){
  const name = $('#m_name').value.trim();
  const color = $('#m_color').value;
  if(!name) return;
  cloud.data.members.push({id: crypto.randomUUID(), name, color}); save();
}
function removeMember(id){
  cloud.data.members = cloud.data.members.filter(x=>x.id!==id); save();
}

// PWA install
let deferredPrompt;
function setupInstall(){
  const btn = $('#installBtn');
  window.addEventListener('beforeinstallprompt', (e)=>{
    e.preventDefault();
    deferredPrompt = e;
    btn.hidden = false;
  });
  btn.addEventListener('click', async ()=>{
    if(!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    btn.hidden = true;
    deferredPrompt = null;
  });
}

