import { useState, useEffect } from "react";

/* ─────────────────────────────────────────────────────────────────────────────
   STORAGE — localStorage simulates user DB (swap with Firebase for global sync)
───────────────────────────────────────────────────────────────────────────── */
const DB_KEY = "quizrupee_db_v3";
const SESSION_KEY = "quizrupee_session_v3";
const loadDB = () => { try { return JSON.parse(localStorage.getItem(DB_KEY)) || { users: {} }; } catch { return { users: {} }; } };
const saveDB = (db) => { try { localStorage.setItem(DB_KEY, JSON.stringify(db)); } catch {} };
const loadSession = () => { try { return JSON.parse(localStorage.getItem(SESSION_KEY)); } catch { return null; } };
const saveSession = (uid) => { try { localStorage.setItem(SESSION_KEY, JSON.stringify(uid)); } catch {} };
const clearSession = () => { try { localStorage.removeItem(SESSION_KEY); } catch {} };

/* ─────────────────────────────────────────────────────────────────────────────
   CONSTANTS
───────────────────────────────────────────────────────────────────────────── */
const CATEGORIES = [
  { id: "sports",        label: "Sports",        icon: "⚽", color: "#FF6B35" },
  { id: "entertainment", label: "Entertainment",  icon: "🎬", color: "#A855F7" },
  { id: "science",       label: "Science",        icon: "🔬", color: "#22C55E" },
  { id: "space",         label: "Space",          icon: "🚀", color: "#3B82F6" },
  { id: "politics",      label: "Politics",       icon: "🏛️", color: "#EF4444" },
  { id: "history",       label: "History",        icon: "📜", color: "#F59E0B" },
  { id: "maths",         label: "Maths",          icon: "➗", color: "#14B8A6" },
  { id: "geography",     label: "Geography",      icon: "🌍", color: "#16A34A" },
  { id: "animals",       label: "Animals",        icon: "🐾", color: "#F97316" },
];

const MEDAL = ["🥇", "🥈", "🥉"];

const CAT_DESC = {
  sports:        "sports, Olympics, cricket, football, tennis, basketball, famous athletes",
  entertainment: "cartoons, Disney, Pixar, kids movies, TV shows, superheroes, popular children's characters",
  science:       "basic science, human body, animals, plants, simple physics and chemistry concepts",
  space:         "planets, solar system, astronauts, stars, rockets, space exploration, galaxies",
  politics:      "Indian government, world capitals, country flags, leaders, democracy basics, Indian history",
  history:       "world history, famous inventors, ancient civilizations, historical events and discoveries",
  maths:         "arithmetic, geometry, multiplication tables, fractions, simple algebra, number facts",
  geography:     "world geography, capital cities, oceans, mountains, rivers, continents, countries",
  animals:       "animal facts, habitats, food chains, pets, wildlife, endangered species, animal behaviors",
};

/* ─────────────────────────────────────────────────────────────────────────────
   GEMINI API — FREE, no credit card needed
   Get your key at: aistudio.google.com → Get API Key (sign in with Gmail)
───────────────────────────────────────────────────────────────────────────── */
const GEMINI_API_KEY = "YOUR_GEMINI_API_KEY_HERE"; // ← paste your key here

const generateQuestions = async (categoryId) => {
  const seed = Math.floor(Math.random() * 999999);
  const desc = CAT_DESC[categoryId] || categoryId;

  const prompt = `Generate exactly 10 unique multiple-choice quiz questions about: ${desc}.

STRICT RULES:
- Questions MUST be for children under 10 years old — very simple and basic
- Each question must have exactly 4 answer choices
- The CORRECT answer must ALWAYS be the FIRST item in the options array (index 0)
- Questions must be fun, clear, and different from each other
- Use variation seed ${seed} to make this set unique every time

Return ONLY a raw JSON array. No markdown. No explanation. No backticks. Just the JSON:
[{"q":"Question here?","options":["Correct answer","Wrong 1","Wrong 2","Wrong 3"]},...]

Exactly 10 items. Nothing else.`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 1.0, maxOutputTokens: 2048 },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini error: ${err}`);
  }

  const data = await res.json();
  const text = (data.candidates?.[0]?.content?.parts?.[0]?.text || "")
    .replace(/```json|```/gi, "").trim();

  const raw = JSON.parse(text);

  // Shuffle options so correct answer isn't always first in the UI
  return raw.slice(0, 10).map((q) => {
    const opts = (q.options || q.answers || []).map((t, i) => ({
      text: typeof t === "string" ? t : t.text || t,
      isCorrect: i === 0,
    }));
    for (let i = opts.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [opts[i], opts[j]] = [opts[j], opts[i]];
    }
    return { question: q.q || q.question, options: opts };
  });
};

/* ─────────────────────────────────────────────────────────────────────────────
   SMALL COMPONENTS
───────────────────────────────────────────────────────────────────────────── */
const BannerAd = ({ pos }) => (
  <div style={{ width: "100%", height: 46, background: "linear-gradient(90deg,#09090f,#10102a,#09090f)", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, borderTop: pos === "bottom" ? "1px solid #1a1a30" : "none", borderBottom: pos === "top" ? "1px solid #1a1a30" : "none", flexShrink: 0 }}>
    <span style={{ fontSize: 13 }}>📢</span>
    <span style={{ color: "#252540", fontSize: 10, fontWeight: 800, letterSpacing: 3, textTransform: "uppercase" }}>Advertisement · Banner {pos === "top" ? "Top" : "Bottom"}</span>
  </div>
);

function AnswerBtn({ text, isCorrect, onAnswer }) {
  const [state, setState] = useState("idle");
  const [done, setDone] = useState(false);
  const click = () => {
    if (done) return;
    setDone(true);
    setState(isCorrect ? "correct" : "wrong");
    setTimeout(() => { onAnswer(isCorrect); }, 780);
  };
  const styles = {
    idle:    { bg: "#0e1420", border: "#1e2a4a", color: "#ccc" },
    correct: { bg: "rgba(34,197,94,.14)", border: "#22c55e", color: "#22c55e" },
    wrong:   { bg: "rgba(239,68,68,.14)", border: "#ef4444", color: "#ef4444" },
  }[state];
  return (
    <button onClick={click} disabled={done} style={{ width: "100%", padding: "13px 16px", borderRadius: 13, border: `2px solid ${styles.border}`, background: styles.bg, color: styles.color, fontSize: 14, fontFamily: "inherit", cursor: done ? "default" : "pointer", textAlign: "left", fontWeight: 700, display: "flex", alignItems: "center", gap: 10, transition: "all .2s" }}>
      <span style={{ fontSize: 14, flexShrink: 0 }}>{state === "correct" ? "✅" : state === "wrong" ? "❌" : "◦"}</span>
      {text}
    </button>
  );
}

function Field({ label, type = "text", placeholder, value, onChange, onEnter }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ fontSize: 10, fontWeight: 800, color: "#3a3a5a", letterSpacing: 1.5, display: "block", marginBottom: 6, textTransform: "uppercase" }}>{label}</label>
      <input type={type} value={value} placeholder={placeholder} onChange={e => onChange(e.target.value)} onKeyDown={e => e.key === "Enter" && onEnter?.()}
        style={{ width: "100%", padding: "12px 16px", background: "#07070e", border: "1.5px solid #1a2238", borderRadius: 12, color: "#e0e0e0", fontSize: 15, fontFamily: "inherit", outline: "none", boxSizing: "border-box" }} />
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   MAIN APP
───────────────────────────────────────────────────────────────────────────── */
export default function App() {
  /* ── auth ── */
  const [uid, setUid] = useState(() => loadSession());
  const [authMode, setAuthMode] = useState("login");
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [authErr, setAuthErr] = useState("");
  const [authBusy, setAuthBusy] = useState(false);

  /* ── navigation ── */
  const [page, setPage] = useState("dashboard");

  /* ── quiz ── */
  const [quiz, setQuiz] = useState(null);
  const [result, setResult] = useState(null);
  const [loadingQ, setLoadingQ] = useState(false);
  const [loadErr, setLoadErr] = useState("");
  const [switchWarn, setSwitchWarn] = useState(false);

  /* ── rewards ── */
  const [upi, setUpi] = useState("");
  const [wdMsg, setWdMsg] = useState("");

  /* ── leaderboard ── */
  const [lbTab, setLbTab] = useState("overall");
  const [lbCat, setLbCat] = useState("sports");

  /* ── derived ── */
  const getProfile = () => uid ? loadDB().users[uid] : null;
  const profile = getProfile();
  const balance = profile ? +((profile.totalEarned || 0) - (profile.withdrawn || 0)).toFixed(2) : 0;

  /* ── tab switch guard ── */
  useEffect(() => {
    if (!quiz) return;
    const onHide = () => { if (document.hidden) { setSwitchWarn(true); setQuiz(null); } };
    const onBlur = () => { setSwitchWarn(true); setQuiz(null); };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("blur", onBlur);
    return () => { document.removeEventListener("visibilitychange", onHide); window.removeEventListener("blur", onBlur); };
  }, [quiz]);

  /* ── auth handlers ── */
  const handleAuth = async () => {
    setAuthErr(""); setAuthBusy(true);
    const db = loadDB();
    if (authMode === "signup") {
      if (!form.name.trim()) { setAuthErr("Please enter your name."); setAuthBusy(false); return; }
      if (!form.email.includes("@")) { setAuthErr("Invalid email address."); setAuthBusy(false); return; }
      if (form.password.length < 6) { setAuthErr("Password must be at least 6 characters."); setAuthBusy(false); return; }
      if (Object.values(db.users).find(u => u.email === form.email.toLowerCase())) { setAuthErr("Email already registered."); setAuthBusy(false); return; }
      const newUid = "u_" + Date.now() + Math.random().toString(36).slice(2, 6);
      db.users[newUid] = { uid: newUid, name: form.name.trim(), email: form.email.toLowerCase(), password: form.password, totalEarned: 0, withdrawn: 0, totalCorrect: 0, totalPlayed: 0, createdAt: Date.now(), categoryStats: {} };
      saveDB(db); saveSession(newUid); setUid(newUid);
    } else {
      const found = Object.values(db.users).find(u => u.email === form.email.toLowerCase() && u.password === form.password);
      if (!found) { setAuthErr("Wrong email or password."); setAuthBusy(false); return; }
      saveSession(found.uid); setUid(found.uid);
    }
    setAuthBusy(false);
  };

  const logout = () => { clearSession(); setUid(null); setPage("dashboard"); setQuiz(null); setResult(null); };

  /* ── quiz handlers ── */
  const startQuiz = async (catId) => {
    if (GEMINI_API_KEY === "YOUR_GEMINI_API_KEY_HERE") {
      setLoadErr("Please add your free Gemini API key. Get it at aistudio.google.com");
      setPage("menu"); return;
    }
    setLoadErr(""); setLoadingQ(true); setResult(null); setPage("quiz");
    try {
      const questions = await generateQuestions(catId);
      setQuiz({ catId, questions, idx: 0, answers: [] });
    } catch (e) {
      console.error(e);
      setLoadErr("Couldn't load questions. Check your internet or API key and try again.");
      setPage("menu");
    }
    setLoadingQ(false);
  };

  const handleAnswer = (correct) => {
    if (!quiz) return;
    const answers = [...quiz.answers, correct];
    if (answers.length === 10) {
      const score = answers.filter(Boolean).length;
      const earned = +(score * 0.1).toFixed(1);
      const db = loadDB();
      const u = db.users[uid];
      const cs = { ...(u.categoryStats || {}) };
      cs[quiz.catId] = {
        played: (cs[quiz.catId]?.played || 0) + 1,
        totalCorrect: (cs[quiz.catId]?.totalCorrect || 0) + score,
        bestScore: Math.max(cs[quiz.catId]?.bestScore || 0, score),
        totalEarned: +((cs[quiz.catId]?.totalEarned || 0) + earned).toFixed(2),
        history: [...(cs[quiz.catId]?.history || []).slice(-19), { date: new Date().toLocaleDateString("en-IN"), score, earned }],
      };
      db.users[uid] = { ...u, totalEarned: +(u.totalEarned + earned).toFixed(2), totalCorrect: (u.totalCorrect || 0) + score, totalPlayed: (u.totalPlayed || 0) + 1, categoryStats: cs };
      saveDB(db);
      setResult({ score, earned, catId: quiz.catId });
      setQuiz(null);
    } else {
      setQuiz({ ...quiz, idx: quiz.idx + 1, answers });
    }
  };

  /* ── withdrawal ── */
  const doWithdraw = () => {
    if (balance < 100) return setWdMsg("You need at least ₹100 to withdraw.");
    if (!upi.trim()) return setWdMsg("Please enter your UPI ID.");
    const amt = Math.floor(balance / 100) * 100;
    const db = loadDB(); db.users[uid].withdrawn = +((db.users[uid].withdrawn || 0) + amt).toFixed(2); saveDB(db);
    setWdMsg(`✅ ₹${amt} withdrawal requested to ${upi}`); setUpi("");
  };

  /* ── leaderboard ── */
  const getLB = () => {
    const users = Object.values(loadDB().users);
    return {
      overall: [...users].sort((a, b) => (b.totalCorrect || 0) - (a.totalCorrect || 0)).slice(0, 20),
      earned:  [...users].sort((a, b) => (b.totalEarned  || 0) - (a.totalEarned  || 0)).slice(0, 20),
      byCat: Object.fromEntries(CATEGORIES.map(cat => [cat.id,
        users.filter(u => u.categoryStats?.[cat.id])
          .map(u => ({ name: u.name, correct: u.categoryStats[cat.id].totalCorrect || 0, played: u.categoryStats[cat.id].played || 0, best: u.categoryStats[cat.id].bestScore || 0 }))
          .sort((a, b) => b.correct - a.correct).slice(0, 10)
      ])),
    };
  };

  /* ═══════════════════════════════════════════════════════════════════════════
     AUTH SCREEN
  ═══════════════════════════════════════════════════════════════════════════ */
  if (!uid) return (
    <div style={{ minHeight: "100vh", background: "#07070e", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 20, fontFamily: "'Nunito', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&family=Orbitron:wght@700;900&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #07070e; }
        @keyframes fadeUp { from{opacity:0;transform:translateY(18px)} to{opacity:1;transform:none} }
        @keyframes glow { 0%,100%{text-shadow:0 0 30px rgba(233,69,96,.3)} 50%{text-shadow:0 0 60px rgba(233,69,96,.6)} }
      `}</style>

      <div style={{ position: "fixed", top: "15%", left: "50%", transform: "translateX(-50%)", width: 280, height: 280, background: "radial-gradient(circle,rgba(233,69,96,.12) 0%,transparent 70%)", pointerEvents: "none" }} />

      <div style={{ textAlign: "center", marginBottom: 32, animation: "fadeUp .5s ease" }}>
        <div style={{ fontFamily: "'Orbitron', sans-serif", fontSize: 32, fontWeight: 900, color: "#e94560", animation: "glow 3s ease infinite" }}>QuizRupee</div>
        <div style={{ fontSize: 12, color: "#3a3a5a", marginTop: 6, letterSpacing: 3, textTransform: "uppercase" }}>Answer · Learn · Earn</div>
        <div style={{ marginTop: 12, display: "flex", gap: 16, justifyContent: "center", fontSize: 12, color: "#2a2a44" }}>
          <span>⚡ AI Questions</span><span>💰 Earn ₹0.10</span><span>🌍 Global Ranks</span>
        </div>
      </div>

      <div style={{ width: "100%", maxWidth: 360, background: "#0c0c1e", borderRadius: 22, padding: "26px 22px", border: "1px solid #1a1a30", animation: "fadeUp .5s .08s ease both" }}>
        <div style={{ display: "flex", background: "#07070e", borderRadius: 14, padding: 4, marginBottom: 22 }}>
          {["login", "signup"].map(m => (
            <button key={m} onClick={() => { setAuthMode(m); setAuthErr(""); }} style={{ flex: 1, padding: "10px", borderRadius: 11, border: "none", cursor: "pointer", background: authMode === m ? "#e94560" : "transparent", color: authMode === m ? "#fff" : "#3a3a5a", fontWeight: 900, fontSize: 12, fontFamily: "inherit", letterSpacing: 1, textTransform: "uppercase", transition: "all .2s" }}>
              {m === "login" ? "Log In" : "Sign Up"}
            </button>
          ))}
        </div>

        {authMode === "signup" && <Field label="Your Name" placeholder="e.g. Akshay Kumar" value={form.name} onChange={v => setForm(f => ({...f, name: v}))} />}
        <Field label="Email" type="email" placeholder="you@gmail.com" value={form.email} onChange={v => setForm(f => ({...f, email: v}))} />
        <Field label="Password" type="password" placeholder="Min 6 characters" value={form.password} onChange={v => setForm(f => ({...f, password: v}))} onEnter={handleAuth} />

        {authErr && <div style={{ background: "rgba(233,69,96,.1)", border: "1px solid #e9456030", borderRadius: 10, padding: "10px 14px", marginBottom: 14, fontSize: 13, color: "#e94560", fontWeight: 700 }}>⚠️ {authErr}</div>}

        <button onClick={handleAuth} disabled={authBusy} style={{ width: "100%", padding: 14, borderRadius: 13, border: "none", background: authBusy ? "#1a1a30" : "linear-gradient(135deg,#e94560,#b91c4a)", color: authBusy ? "#444" : "#fff", fontWeight: 900, fontSize: 16, fontFamily: "inherit", cursor: authBusy ? "not-allowed" : "pointer", letterSpacing: .5, transition: "all .2s" }}>
          {authBusy ? "Please wait..." : authMode === "login" ? "Log In →" : "Create Account →"}
        </button>

        <div style={{ textAlign: "center", marginTop: 14, fontSize: 13, color: "#3a3a5a" }}>
          {authMode === "login" ? "New here?" : "Already have an account?"}
          <button onClick={() => { setAuthMode(authMode === "login" ? "signup" : "login"); setAuthErr(""); }} style={{ background: "none", border: "none", color: "#e94560", fontWeight: 800, cursor: "pointer", fontFamily: "inherit", fontSize: 13, marginLeft: 6 }}>
            {authMode === "login" ? "Sign Up" : "Log In"}
          </button>
        </div>
      </div>

      <div style={{ marginTop: 20, fontSize: 11, color: "#1e1e30", textAlign: "center", lineHeight: 1.9 }}>
        Powered by Gemini AI · Free to play<br />
        ₹0.10 per correct answer · Withdraw at ₹100 via UPI
      </div>
    </div>
  );

  /* ═══════════════════════════════════════════════════════════════════════════
     MAIN APP SHELL
  ═══════════════════════════════════════════════════════════════════════════ */
  const p = getProfile();
  const lb = getLB();

  return (
    <div style={{ minHeight: "100vh", background: "#07070e", color: "#e0e0e0", fontFamily: "'Nunito', sans-serif", display: "flex", flexDirection: "column", maxWidth: 430, margin: "0 auto" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&family=Orbitron:wght@700;900&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #07070e; }
        ::-webkit-scrollbar { width: 3px; } ::-webkit-scrollbar-thumb { background: #e94560; border-radius: 2px; }
        @keyframes fadeUp { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:none} }
        @keyframes spin { to{transform:rotate(360deg)} }
        @keyframes pop { 0%{opacity:0;transform:scale(.85)} 60%{transform:scale(1.05)} 100%{opacity:1;transform:scale(1)} }
        .card { background: #0c0c1e; border-radius: 15px; padding: 14px 15px; border: 1px solid #181828; }
        .pbar { height: 5px; background: #151525; border-radius: 3px; overflow: hidden; }
        .pfill { height: 100%; border-radius: 3px; background: linear-gradient(90deg,#e94560,#f59e0b); transition: width .4s; }
        .hrow { display:flex; justify-content:space-between; align-items:center; padding:7px 0; border-bottom:1px solid #111120; font-size:12px; }
        .lrow { display:flex; align-items:center; gap:10px; padding:9px 0; border-bottom:1px solid #111120; }
        .nav { position:fixed; bottom:0; left:50%; transform:translateX(-50%); width:100%; max-width:430px; background:#09091a; border-top:1px solid #14142a; display:flex; z-index:100; }
        .nb { flex:1; background:none; border:none; cursor:pointer; display:flex; flex-direction:column; align-items:center; gap:2px; padding:9px 0 7px; }
        .nb span { font-size:19px; }
        .nb small { font-size:9px; font-weight:800; color:#252540; letter-spacing:1px; text-transform:uppercase; transition:color .2s; }
        .nb.on small { color:#e94560; }
        .overlay { position:fixed; inset:0; background:rgba(0,0,0,.92); z-index:200; display:flex; align-items:center; justify-content:center; padding:24px; }
        .modal { background:#0c0c1e; border-radius:22px; padding:28px 22px; border:1.5px solid #e94560; max-width:330px; width:100%; text-align:center; animation:pop .3s ease; }
        .inp { width:100%; padding:12px 16px; background:#07070e; border:1.5px solid #181828; border-radius:12px; color:#e0e0e0; font-size:15px; font-family:inherit; outline:none; transition:border .2s; }
        .inp:focus { border-color:#e94560; }
      `}</style>

      <BannerAd pos="top" />

      <div style={{ flex: 1, overflowY: "auto", paddingBottom: 68 }}>

        {/* ══ DASHBOARD ══════════════════════════════════════════════════════ */}
        {page === "dashboard" && (
          <div style={{ padding: "18px 15px", animation: "fadeUp .35s ease" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
              <div>
                <div style={{ fontFamily: "'Orbitron', sans-serif", fontSize: 19, fontWeight: 900, color: "#e94560" }}>QuizRupee</div>
                <div style={{ fontSize: 12, color: "#333", marginTop: 1 }}>Hey {p?.name?.split(" ")[0]} 👋</div>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <div style={{ background: "#0c0c1e", borderRadius: 12, padding: "7px 12px", border: "1.5px solid #f59e0b22", textAlign: "center" }}>
                  <div style={{ fontSize: 9, color: "#f59e0b", fontWeight: 800, letterSpacing: 1 }}>BALANCE</div>
                  <div style={{ fontFamily: "'Orbitron', sans-serif", fontSize: 16, fontWeight: 900, color: "#f59e0b" }}>₹{balance.toFixed(2)}</div>
                </div>
                <button onClick={logout} title="Log out" style={{ background: "#0c0c1e", border: "1px solid #181828", borderRadius: 10, color: "#333", fontSize: 17, cursor: "pointer", padding: "8px 10px" }}>⏻</button>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 9, marginBottom: 18 }}>
              {[["🎮", p?.totalPlayed || 0, "QUIZZES", "#e94560"], ["✅", p?.totalCorrect || 0, "CORRECT", "#22c55e"], ["💰", `₹${(p?.totalEarned||0).toFixed(1)}`, "EARNED", "#f59e0b"]].map(([ic,v,l,c]) => (
                <div key={l} className="card" style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 19 }}>{ic}</div>
                  <div style={{ fontSize: 17, fontWeight: 900, color: c, marginTop: 2 }}>{v}</div>
                  <div style={{ fontSize: 9, color: "#252540", fontWeight: 800, letterSpacing: 1 }}>{l}</div>
                </div>
              ))}
            </div>

            <div style={{ fontSize: 10, fontWeight: 800, color: "#252540", letterSpacing: 2, textTransform: "uppercase", marginBottom: 10 }}>Category Records</div>
            {CATEGORIES.map(cat => {
              const cs = p?.categoryStats?.[cat.id];
              const acc = cs ? Math.round((cs.totalCorrect / (cs.played * 10)) * 100) : 0;
              return (
                <div key={cat.id} className="card" style={{ marginBottom: 9 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: cs ? 10 : 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ width: 36, height: 36, borderRadius: 10, background: `${cat.color}18`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, border: `1px solid ${cat.color}25`, flexShrink: 0 }}>{cat.icon}</div>
                      <div>
                        <div style={{ fontWeight: 800, fontSize: 14 }}>{cat.label}</div>
                        <div style={{ fontSize: 11, color: "#333", marginTop: 1 }}>{cs ? `${cs.played} round${cs.played>1?"s":""} · Best ${cs.bestScore}/10` : "Not played yet"}</div>
                      </div>
                    </div>
                    {cs && <div style={{ textAlign: "right" }}><div style={{ fontWeight: 900, color: "#f59e0b", fontSize: 14 }}>₹{cs.totalEarned.toFixed(1)}</div><div style={{ fontSize: 10, color: "#333" }}>{acc}% acc</div></div>}
                  </div>
                  {cs && <>
                    <div className="pbar" style={{ marginBottom: 8 }}><div className="pfill" style={{ width: `${acc}%` }} /></div>
                    {(cs.history||[]).slice(-3).reverse().map((r,i) => (
                      <div key={i} className="hrow"><span style={{ color: "#333" }}>{r.date}</span><span style={{ fontWeight: 800, color: r.score>=7?"#22c55e":r.score>=5?"#f59e0b":"#e94560" }}>{r.score}/10</span><span style={{ color: "#f59e0b", fontWeight: 800 }}>+₹{r.earned}</span></div>
                    ))}
                  </>}
                </div>
              );
            })}
          </div>
        )}

        {/* ══ QUIZ MENU ═══════════════════════════════════════════════════════ */}
        {page === "menu" && !quiz && !result && (
          <div style={{ padding: "18px 15px", animation: "fadeUp .35s ease" }}>
            <div style={{ fontFamily: "'Orbitron', sans-serif", fontSize: 17, fontWeight: 900, color: "#e94560", marginBottom: 4 }}>Choose Category</div>
            <div style={{ fontSize: 12, color: "#333", marginBottom: 6 }}>Gemini AI generates fresh questions every round</div>

            {GEMINI_API_KEY === "YOUR_GEMINI_API_KEY_HERE" && (
              <div style={{ background: "rgba(245,158,11,.1)", border: "1px solid #f59e0b33", borderRadius: 12, padding: "12px 14px", marginBottom: 14, fontSize: 13, color: "#f59e0b", fontWeight: 700, lineHeight: 1.6 }}>
                ⚠️ Add your free Gemini API key!<br/>
                <span style={{ fontSize: 11, color: "#8a6a20", fontWeight: 600 }}>Open the code → find GEMINI_API_KEY → replace with your key from aistudio.google.com</span>
              </div>
            )}

            {loadErr && <div style={{ background: "rgba(239,68,68,.1)", border: "1px solid #ef444430", borderRadius: 12, padding: "11px 14px", marginBottom: 14, fontSize: 13, color: "#ef4444", fontWeight: 700 }}>⚠️ {loadErr}</div>}

            <div style={{ fontSize: 11, color: "#252540", marginBottom: 14, padding: "9px 13px", background: "#0c0c1e", borderRadius: 10, border: "1px solid #181828", lineHeight: 1.7 }}>
              💡 10 questions per round · ₹0.10 per correct answer · Don't switch tabs!
            </div>

            {CATEGORIES.map(cat => {
              const cs = p?.categoryStats?.[cat.id];
              return (
                <div key={cat.id} onClick={() => !loadingQ && startQuiz(cat.id)}
                  style={{ cursor: loadingQ ? "not-allowed" : "pointer", background: "#0c0c1e", borderRadius: 16, padding: "13px 15px", marginBottom: 9, border: "1.5px solid #181828", display: "flex", alignItems: "center", gap: 13, transition: "all .2s", opacity: loadingQ ? .5 : 1 }}
                  onMouseEnter={e => { if (!loadingQ) { e.currentTarget.style.borderColor = cat.color; e.currentTarget.style.background = `${cat.color}12`; }}}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = "#181828"; e.currentTarget.style.background = "#0c0c1e"; }}>
                  <div style={{ width: 46, height: 46, borderRadius: 13, background: `${cat.color}18`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 23, border: `1.5px solid ${cat.color}28`, flexShrink: 0 }}>{cat.icon}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 800, fontSize: 15 }}>{cat.label}</div>
                    <div style={{ fontSize: 11, color: "#333", marginTop: 2 }}>{cs ? `Best: ${cs.bestScore}/10 · Played ${cs.played}×` : "Tap to play"}</div>
                  </div>
                  <div style={{ color: "#252540", fontSize: 15 }}>▶</div>
                </div>
              );
            })}
          </div>
        )}

        {/* ══ LOADING ═════════════════════════════════════════════════════════ */}
        {page === "quiz" && loadingQ && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 300, padding: 40 }}>
            <div style={{ width: 46, height: 46, border: "4px solid #181828", borderTopColor: "#e94560", borderRadius: "50%", animation: "spin 1s linear infinite", marginBottom: 20 }} />
            <div style={{ fontFamily: "'Orbitron', sans-serif", fontSize: 13, color: "#e94560", fontWeight: 900 }}>Gemini AI Generating...</div>
            <div style={{ fontSize: 12, color: "#333", marginTop: 6 }}>Fresh questions just for you ✨</div>
          </div>
        )}

        {/* ══ ACTIVE QUIZ ═════════════════════════════════════════════════════ */}
        {page === "quiz" && quiz && !loadingQ && (
          <div style={{ padding: "18px 15px", animation: "fadeUp .3s ease" }}>
            {(() => {
              const cat = CATEGORIES.find(c => c.id === quiz.catId);
              const q = quiz.questions[quiz.idx];
              return <>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 13 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 21 }}>{cat?.icon}</span>
                    <span style={{ fontWeight: 900, fontSize: 14 }}>{cat?.label}</span>
                  </div>
                  <div style={{ background: "#0c0c1e", borderRadius: 8, padding: "5px 12px", fontSize: 12, fontWeight: 900, color: "#e94560", border: "1px solid #e9456020" }}>{quiz.idx + 1}/10</div>
                </div>

                <div className="pbar" style={{ marginBottom: 16 }}><div className="pfill" style={{ width: `${(quiz.idx / 10) * 100}%` }} /></div>

                <div style={{ display: "flex", gap: 5, justifyContent: "center", marginBottom: 16 }}>
                  {quiz.answers.map((a, i) => <div key={i} style={{ width: 9, height: 9, borderRadius: "50%", background: a ? "#22c55e" : "#ef4444" }} />)}
                  {Array(10 - quiz.answers.length).fill(0).map((_, i) => <div key={i} style={{ width: 9, height: 9, borderRadius: "50%", background: "#1a1a28" }} />)}
                </div>

                <div style={{ background: "#0c0c1e", borderRadius: 17, padding: "19px 17px", marginBottom: 16, border: "1px solid #181828", minHeight: 88, display: "flex", alignItems: "center" }}>
                  <p style={{ fontSize: 16, fontWeight: 800, lineHeight: 1.55 }}>Q{quiz.idx + 1}. {q.question}</p>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                  {q.options.map((opt, i) => <AnswerBtn key={i} text={opt.text} isCorrect={opt.isCorrect} onAnswer={handleAnswer} />)}
                </div>

                <div style={{ marginTop: 14, textAlign: "center", fontSize: 11, color: "#1e1e30" }}>⚠️ Switching apps restarts this round</div>
              </>;
            })()}
          </div>
        )}

        {/* ══ RESULT ══════════════════════════════════════════════════════════ */}
        {result && page === "quiz" && (
          <div style={{ padding: "30px 15px", textAlign: "center", animation: "pop .4s ease" }}>
            <div style={{ fontSize: 66, marginBottom: 12 }}>{result.score >= 8 ? "🏆" : result.score >= 5 ? "⭐" : "💪"}</div>
            <div style={{ fontFamily: "'Orbitron', sans-serif", fontSize: 21, fontWeight: 900, marginBottom: 8, color: result.score >= 8 ? "#f59e0b" : result.score >= 5 ? "#3b82f6" : "#e94560" }}>
              {result.score >= 8 ? "Brilliant!" : result.score >= 5 ? "Good Job!" : "Keep Going!"}
            </div>
            <div style={{ fontSize: 15, color: "#555", marginBottom: 22 }}>
              <strong style={{ color: "#fff", fontSize: 22 }}>{result.score}</strong> / 10 correct
            </div>
            <div style={{ background: "linear-gradient(135deg,#10102a,#0a0a1e)", borderRadius: 20, padding: 22, marginBottom: 22, border: "1.5px solid #f59e0b33" }}>
              <div style={{ fontSize: 12, color: "#555", marginBottom: 4 }}>You Earned</div>
              <div style={{ fontFamily: "'Orbitron', sans-serif", fontSize: 38, fontWeight: 900, color: "#f59e0b" }}>₹{result.earned.toFixed(2)}</div>
              <div style={{ fontSize: 12, color: "#333", marginTop: 4 }}>₹0.10 × {result.score} correct answers</div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 11 }}>
              <button onClick={() => { setResult(null); setPage("menu"); }} style={{ padding: 14, borderRadius: 13, background: "#0c0c1e", color: "#aaa", fontSize: 14, fontWeight: 800, border: "1.5px solid #181828", cursor: "pointer", fontFamily: "inherit" }}>Other Categories</button>
              <button onClick={() => startQuiz(result.catId)} style={{ padding: 14, borderRadius: 13, background: "linear-gradient(135deg,#e94560,#b91c4a)", color: "#fff", fontSize: 14, fontWeight: 800, border: "none", cursor: "pointer", fontFamily: "inherit" }}>Play Again ▶</button>
            </div>
          </div>
        )}

        {/* ══ REWARDS ══════════════════════════════════════════════════════════ */}
        {page === "rewards" && (
          <div style={{ padding: "18px 15px", animation: "fadeUp .35s ease" }}>
            <div style={{ fontFamily: "'Orbitron', sans-serif", fontSize: 17, fontWeight: 900, color: "#f59e0b", marginBottom: 18 }}>💎 Rewards</div>

            <div style={{ background: "linear-gradient(135deg,#10102a,#0a0a1e)", borderRadius: 20, padding: 22, marginBottom: 14, border: "1px solid #f59e0b22", textAlign: "center" }}>
              <div style={{ fontSize: 12, color: "#555", marginBottom: 4 }}>Available Balance</div>
              <div style={{ fontFamily: "'Orbitron', sans-serif", fontSize: 40, fontWeight: 900, color: "#f59e0b" }}>₹{balance.toFixed(2)}</div>
              <div style={{ height: 6, borderRadius: 3, background: "#181828", margin: "14px 0 6px", overflow: "hidden" }}>
                <div style={{ height: "100%", borderRadius: 3, width: `${Math.min((balance/100)*100,100)}%`, background: balance >= 100 ? "linear-gradient(90deg,#f59e0b,#e67e22)" : "linear-gradient(90deg,#e94560,#b91c4a)", transition: "width .5s" }} />
              </div>
              <div style={{ fontSize: 11, color: "#333" }}>{balance < 100 ? `₹${(100-balance).toFixed(2)} more to unlock withdrawal` : "🎉 Ready to withdraw!"}</div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9, marginBottom: 14 }}>
              <div className="card" style={{ textAlign: "center" }}><div style={{ fontSize: 20 }}>💰</div><div style={{ fontSize: 18, fontWeight: 900, color: "#22c55e" }}>₹{(p?.totalEarned||0).toFixed(2)}</div><div style={{ fontSize: 9, color: "#252540", fontWeight: 800, letterSpacing: 1 }}>TOTAL EARNED</div></div>
              <div className="card" style={{ textAlign: "center" }}><div style={{ fontSize: 20 }}>🏦</div><div style={{ fontSize: 18, fontWeight: 900, color: "#e94560" }}>₹{(p?.withdrawn||0).toFixed(2)}</div><div style={{ fontSize: 9, color: "#252540", fontWeight: 800, letterSpacing: 1 }}>WITHDRAWN</div></div>
            </div>

            <div className="card" style={{ marginBottom: 14 }}>
              <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 13 }}>Withdraw via UPI</div>
              <input className="inp" placeholder="Your UPI ID (e.g. name@okaxis)" value={upi} onChange={e => setUpi(e.target.value)} style={{ marginBottom: 11 }} />
              <button onClick={doWithdraw} style={{ width: "100%", padding: 14, borderRadius: 12, background: balance >= 100 ? "linear-gradient(135deg,#f59e0b,#e67e22)" : "#181828", color: balance >= 100 ? "#000" : "#333", fontWeight: 900, fontSize: 15, border: "none", cursor: balance >= 100 ? "pointer" : "not-allowed", fontFamily: "inherit" }}>
                {balance >= 100 ? `Withdraw ₹${Math.floor(balance/100)*100}` : `Need ₹${(100-balance).toFixed(2)} more`}
              </button>
              {wdMsg && <div style={{ marginTop: 10, fontSize: 13, fontWeight: 700, color: wdMsg.startsWith("✅") ? "#22c55e" : "#e94560" }}>{wdMsg}</div>}
            </div>

            <div className="card">
              <div style={{ fontSize: 10, fontWeight: 800, color: "#252540", letterSpacing: 2, marginBottom: 12 }}>HOW IT WORKS</div>
              {[["✅","Each correct answer","₹0.10"],["🎯","Complete all 10 questions","to see results"],["📱","Stay in app during quiz","or it restarts"],["💰","Minimum balance to withdraw","₹100"],["⚡","Every round","Gemini generates new Qs"]].map(([ic,l,v]) => (
                <div key={l} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 0", borderBottom: "1px solid #111120", fontSize: 13 }}>
                  <span style={{ color: "#444" }}>{ic} {l}</span>
                  <span style={{ color: "#f59e0b", fontWeight: 800, flexShrink: 0, marginLeft: 8 }}>{v}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ══ GLOBAL LEADERBOARD ══════════════════════════════════════════════ */}
        {page === "global" && (
          <div style={{ padding: "18px 15px", animation: "fadeUp .35s ease" }}>
            <div style={{ fontFamily: "'Orbitron', sans-serif", fontSize: 17, fontWeight: 900, color: "#3b82f6", marginBottom: 4 }}>🌍 Global Stats</div>
            <div style={{ fontSize: 12, color: "#333", marginBottom: 16 }}>Rankings across all players on this device</div>

            <div style={{ display: "flex", gap: 8, marginBottom: 16, overflowX: "auto", paddingBottom: 4 }}>
              {[["overall","🏆 Overall"],["earned","💰 Earners"],["category","📂 Category"]].map(([id,label]) => (
                <button key={id} onClick={() => setLbTab(id)} style={{ padding: "8px 15px", borderRadius: 20, border: "1.5px solid", borderColor: lbTab===id?"#3b82f6":"#181828", background: lbTab===id?"rgba(59,130,246,.14)":"transparent", color: lbTab===id?"#3b82f6":"#333", fontWeight: 800, fontSize: 12, cursor: "pointer", whiteSpace: "nowrap", fontFamily: "inherit", flexShrink: 0, transition: "all .2s" }}>
                  {label}
                </button>
              ))}
            </div>

            {lbTab === "overall" && (
              <div className="card">
                <div style={{ fontSize: 10, fontWeight: 800, color: "#252540", letterSpacing: 2, marginBottom: 12 }}>TOP PLAYERS — CORRECT ANSWERS</div>
                {lb.overall.length === 0
                  ? <div style={{ color: "#333", textAlign: "center", padding: "24px 0", fontSize: 14 }}>No players yet — be the first! 🎉</div>
                  : lb.overall.map((u, i) => (
                    <div key={u.uid} className="lrow">
                      <div style={{ width: 26, textAlign: "center", fontSize: i<3?20:12, fontWeight: 900, color: i<3?"#f59e0b":"#252540", flexShrink: 0 }}>{i<3?MEDAL[i]:`#${i+1}`}</div>
                      <div style={{ flex: 1 }}><div style={{ fontWeight: 800, fontSize: 14 }}>{u.name}</div><div style={{ fontSize: 11, color: "#333" }}>{u.totalPlayed||0} rounds played</div></div>
                      <div style={{ fontWeight: 900, fontSize: 14, color: "#22c55e" }}>{u.totalCorrect||0} ✅</div>
                    </div>
                  ))}
              </div>
            )}

            {lbTab === "earned" && (
              <div className="card">
                <div style={{ fontSize: 10, fontWeight: 800, color: "#252540", letterSpacing: 2, marginBottom: 12 }}>TOP EARNERS</div>
                {lb.earned.length === 0
                  ? <div style={{ color: "#333", textAlign: "center", padding: "24px 0", fontSize: 14 }}>No earners yet!</div>
                  : lb.earned.map((u, i) => (
                    <div key={u.uid} className="lrow">
                      <div style={{ width: 26, textAlign: "center", fontSize: i<3?20:12, fontWeight: 900, color: i<3?"#f59e0b":"#252540", flexShrink: 0 }}>{i<3?MEDAL[i]:`#${i+1}`}</div>
                      <div style={{ flex: 1 }}><div style={{ fontWeight: 800, fontSize: 14 }}>{u.name}</div><div style={{ fontSize: 11, color: "#333" }}>{u.totalCorrect||0} correct · {u.totalPlayed||0} rounds</div></div>
                      <div style={{ fontWeight: 900, fontSize: 14, color: "#f59e0b" }}>₹{(u.totalEarned||0).toFixed(2)}</div>
                    </div>
                  ))}
              </div>
            )}

            {lbTab === "category" && (
              <>
                <div style={{ display: "flex", gap: 7, overflowX: "auto", paddingBottom: 10, marginBottom: 13 }}>
                  {CATEGORIES.map(cat => (
                    <button key={cat.id} onClick={() => setLbCat(cat.id)} style={{ padding: "7px 13px", borderRadius: 20, border: "1.5px solid", borderColor: lbCat===cat.id?cat.color:"#181828", background: lbCat===cat.id?`${cat.color}15`:"transparent", color: lbCat===cat.id?cat.color:"#333", fontWeight: 800, fontSize: 11, cursor: "pointer", whiteSpace: "nowrap", fontFamily: "inherit", flexShrink: 0, transition: "all .2s" }}>
                      {cat.icon} {cat.label}
                    </button>
                  ))}
                </div>
                <div className="card">
                  <div style={{ fontSize: 10, fontWeight: 800, color: "#252540", letterSpacing: 2, marginBottom: 12 }}>
                    {CATEGORIES.find(c=>c.id===lbCat)?.icon} TOP IN {lbCat.toUpperCase()}
                  </div>
                  {(!lb.byCat[lbCat] || lb.byCat[lbCat].length === 0)
                    ? <div style={{ color: "#333", textAlign: "center", padding: "24px 0", fontSize: 14 }}>No one has played this yet!</div>
                    : lb.byCat[lbCat].map((u, i) => (
                      <div key={i} className="lrow">
                        <div style={{ width: 26, textAlign: "center", fontSize: i<3?20:12, fontWeight: 900, color: i<3?"#f59e0b":"#252540", flexShrink: 0 }}>{i<3?MEDAL[i]:`#${i+1}`}</div>
                        <div style={{ flex: 1 }}><div style={{ fontWeight: 800, fontSize: 14 }}>{u.name}</div><div style={{ fontSize: 11, color: "#333" }}>{u.played} rounds · Best {u.best}/10</div></div>
                        <div style={{ fontWeight: 900, fontSize: 14, color: "#22c55e" }}>{u.correct} ✅</div>
                      </div>
                    ))}
                </div>
              </>
            )}
          </div>
        )}

      </div>

      <BannerAd pos="bottom" />

      {/* NAV */}
      <nav className="nav">
        {[["dashboard","🏠","Home"],["menu","🎮","Play"],["rewards","💎","Earn"],["global","🌍","Global"]].map(([id,ic,lbl]) => (
          <button key={id} className={`nb ${page===id?"on":""}`} onClick={() => { if (!quiz) { setResult(null); setPage(id); } }} style={{ opacity: quiz && id !== "quiz" ? .35 : 1 }}>
            <span>{ic}</span><small>{lbl}</small>
          </button>
        ))}
      </nav>

      {/* SWITCH WARNING */}
      {switchWarn && (
        <div className="overlay">
          <div className="modal">
            <div style={{ fontSize: 50, marginBottom: 14 }}>⚠️</div>
            <div style={{ fontFamily: "'Orbitron', sans-serif", fontSize: 15, fontWeight: 900, color: "#e94560", marginBottom: 10 }}>Quiz Restarted!</div>
            <p style={{ fontSize: 14, color: "#555", lineHeight: 1.65, marginBottom: 22 }}>Switching apps during the quiz will restart the round. Stay in the app to keep your progress.</p>
            <button onClick={() => { setSwitchWarn(false); setPage("menu"); }} style={{ width: "100%", padding: 14, borderRadius: 13, background: "linear-gradient(135deg,#e94560,#b91c4a)", color: "#fff", fontWeight: 900, fontSize: 16, border: "none", cursor: "pointer", fontFamily: "inherit" }}>
              Got It — Back to Menu
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
