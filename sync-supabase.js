// יצירת לקוח Supabase
const supa = supabase.createClient(window.supabaseConfig.url, window.supabaseConfig.anonKey);

// טבלה: families (שורה אחת לכל משפחה) עם עמודת data מסוג JSONB
// נשמור את ה-id של המשפחה בלוקאל כדי שלא נצטרך לבחור כל פעם
let familyId = localStorage.getItem('familyId') || null;
let realtimeSub = null;

const cloud = {
  data: null,

  async requireAuth() {
    // מאזין לשינויי התחברות
    supa.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN') {
        document.getElementById('tabs').hidden = false;
        if (!familyId) {
          // נשתמש ב-user.id כ-owner וניצור משפחה אם אין
          await this.ensureFamilyForUser(session.user.id);
        }
        await this.subscribeRealtime();
        router();
      }
      if (event === 'SIGNED_OUT') {
        document.getElementById('tabs').hidden = true;
        this.data = null;
        router();
      }
    });

    // אם כבר מחובר – המשך; אחרת הצג מסך כניסה
    const { data: { user } } = await supa.auth.getUser();
    if (!user) {
      renderLogin();
      return null;
    }
    document.getElementById('tabs').hidden = false;
    if (!familyId) await this.ensureFamilyForUser(user.id);
    await this.subscribeRealtime();
    return user;
  },

  // יוצר/מביא משפחה לבעלים (Owner)
  async ensureFamilyForUser(ownerId) {
    if (familyId) return familyId;

    // נסה למצוא משפחה קיימת שה-owner שלה הוא המשתמש
    let { data: rows, error } = await supa.from('families')
      .select('id,data')
      .eq('owner', ownerId)
      .limit(1);

    if (error) { console.error(error); return; }

    if (rows && rows.length) {
      familyId = rows[0].id;
      localStorage.setItem('familyId', familyId);
      this.data = rows[0].data;
      return familyId;
    }

    // אם אין – צור חדשה עם נתוני ברירת מחדל
    const initial = this.defaultData();
    const { data: inserted, error: insErr } = await supa.from('families')
      .insert([{ owner: ownerId, data: initial }])
      .select('id');

    if (insErr) { console.error(insErr); return; }
    familyId = inserted[0].id;
    localStorage.setItem('familyId', familyId);
    this.data = initial;
    return familyId;
  },

  defaultData(){
    return {
      familyName:'משפחת לייבוביץ׳',
      members: [
        {id: crypto.randomUUID(), name:'אמא', color:'#F2C94C'},
        {id: crypto.randomUUID(), name:'אבא', color:'#56CCF2'}
      ],
      tasks: [], shopping: [], activities: [], events: [], messages: [],
      unlimitedUsers: true, updatedAt: Date.now()
    };
  },

  // טעינה חד-פעמית
  async loadOnce(){
    if (!familyId) return;
    const { data, error } = await supa.from('families').select('data').eq('id', familyId).single();
    if (!error && data) {
      this.data = data.data || this.defaultData();
    }
  },

  // שמירת כל המסמך (data JSON)
  async save(newData){
    if (!familyId) return;
    const payload = { ...(newData || this.data), updatedAt: Date.now() };
    this.data = payload;
    const { error } = await supa.from('families').update({ data: payload }).eq('id', familyId);
    if (error) console.error('save error', error);
  },

  // Realtime על השורה של המשפחה
  async subscribeRealtime(){
    if (!familyId) return;
    if (realtimeSub) {
      await supa.removeChannel(realtimeSub);
      realtimeSub = null;
    }
    // טען פעם אחת מיד
    await this.loadOnce();

    realtimeSub = supa.channel('families:'+familyId)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'families',
        filter: `id=eq.${familyId}`
      }, (payload) => {
        if (payload.new && payload.new.data) {
          this.data = payload.new.data;
          router();
        }
      }).subscribe((status) => {
        // console.log('realtime status', status);
      });
  }
};

// מסך כניסה – Google או מייל בקוד חד-פעמי
function renderLogin(){
  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="card">
      <h3>כניסה</h3>
      <p class="muted">היכנס/י כדי לסנכרן בין כל המכשירים.</p>
      <div class="auth">
        <button class="primary" id="googleBtn">כניסה עם Google</button>
      </div>
      <div style="margin-top:1rem">
        <div class="row">
          <input id="email" type="email" placeholder="אימייל לכניסה בקוד">
          <button class="ok" id="emailBtn">שלח קוד</button>
        </div>
        <p class="muted">תקבל/י קוד אימות למייל. הזן/י אותו במסך הבא.</p>
      </div>
    </div>
  `;
  document.getElementById('googleBtn').onclick = async ()=>{
    await supa.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.href } });
  };
  document.getElementById('emailBtn').onclick = async ()=>{
    const email = document.getElementById('email').value.trim();
    if(!email) return;
    const { data, error } = await supa.auth.signInWithOtp({ email });
    if (error) { alert('שגיאה בשליחת קוד'); return; }
    const code = prompt('הכנס/י את הקוד שהגיע למייל:');
    if (!code) return;
    // verify OTP (email) — Supabase תומך ב-verification אוטומטי דרך הלינק; כאן פתרון פשוט
    // אם ההתחברות לא הושלמה, אפשר לבקש שוב.
    // בפועל, קל יותר ללחוץ על הלינק שנשלח במייל.
  };
}

async function signOut(){
  await supa.auth.signOut();
  localStorage.removeItem('familyId');
  location.reload();
}

// נחשוף לאפליקציה
window.cloud = cloud;
window.signOut = signOut;
