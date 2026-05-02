 import { useState, useEffect } from "react";

/* ── CONSTANTS ─────────────────────────────────────────────────────────── */
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

/* ── API HELPER ─────────────────────────────────────────────────────────── */
const api = async (path, { method = "GET", body } = {}) => {
  const token = localStorage.getItem("qr_token");
  const res = await fetch(`/api${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
};

/* ── GEMINI API ─────────────────────────────────────────────────────────── */
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || "";

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
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 1.0, maxOutputTokens: 2048 } }),
  });
  if (!res.ok) { const err = await res.text(); throw new Error(`Gemini error: ${err}`); }
  const data = await res.json();
  const text = (data.candidates?.[0]?.content?.parts?.[0]?.text || "").replace(/```json|```/gi, "").trim();
  const raw = JSON.parse(text);
  return raw.slice(0, 10).map((q) => {
    const opts = (q.options || q.answers || []).map((t, i) => ({ text: typeof t === "string" ? t : t.text || t, isCorrect: i === 0 }));
    for (let i = opts.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [opts[i], opts[j]] = [opts[j], opts[i]]; }
    return { question: q.q || q.question, options: opts };
  });
};

/* ── SMALL COMPONENTS ───────────────────────────────────────────────────── */
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
  const styles = { idle: { bg: "#0e1420", border: "#1e2a4a", color: "#ccc" }, correct: { bg: "rgba(34,197,94,.14)", border: "#22c55e", color: "#22c55e" }, wrong: { bg: "rgba(239,68,68,.14)", border: "#ef4444", color: "#ef4444" } }[state];
  return (
    <button onClick={click} disabled={done} style={{ width: "100%", padding: "13px 16px", borderRadius: 13, border: `2px solid ${styles.border}`, background: styles.bg, color: styles.color, fontSize: 14, fontFamily: "inherit", cursor: done ? "default" : "pointer", textAlign: "left", fontWeight: 700, display: "flex", alignItems: "center", gap: 10, transition: "all .2s" }}>
      <span style={{ fontSize: 14, flexShrink: 0 }}>{state === "correct" ? "✅" : state === "wrong" ? "❌" : "◦"}</span>{text}
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

const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&family=Orbitron:wght@700;900&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #07070e; }
  ::-webkit-scrollbar { width: 3px; } ::-webkit-scrollbar-thumb { background: #e94560; border-radius: 2px; }
  @keyframes fadeUp { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:none} }
  @keyframes spin { to{transform:rotate(360deg)} }
  @keyframes pop { 0%{opacity:0;transform:scale(.85)} 60%{transform:scale(1.05)} 100%{opacity:1;transform:scale(1)} }
  @keyframes glow { 0%,100%{text-shadow:0 0 30px rgba(233,69,96,.3)} 50%{text-shadow:0 0 60px rgba(233,69,96,.6)} }
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
  .tag { display:inline-block; padding:2px 8px; border-radius:20px; font-size:10px; font-weight:800; letter-spacing:.5px; }
`;

/* ── MAIN APP ───────────────────────────────────────────────────────────── */
export default function App() {
  /* auth */
  const [token, setToken] = useState(() => localStorage.getItem("qr_token"));
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authMode, setAuthMode] = useState("login");
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [authErr, setAuthErr] = useState("");
  const [authBusy, setAuthBusy] = useState(false);

  /* nav */
  const [page, setPage] = useState("dashboard");

  /* category stats */
  const [catStats, setCatStats] = useState([]);

  /* quiz */
  const [quiz, setQuiz] = useState(null);
  const [result, setResult] = useState(null);
  const [loadingQ, setLoadingQ] = useState(false);
  const [loadErr, setLoadErr] = useState("");
  const [switchWarn, setSwitchWarn] = useState(false);

  /* rewards */
  const [upi, setUpi] = useState("");
  const [wdMsg, setWdMsg] = useState({ text: "", type: "" });
  const [wdHistory, setWdHistory] = useState([]);
  const [wdLoading, setWdLoading] = useState(false);

  /* leaderboard */
  const [lbTab, setLbTab] = useState("overall");
  const [lbCat, setLbCat] = useState("sports");
  const [lb, setLb] = useState({ overall: [], earners: [] });
  const [lbCatData, setLbCatData] = useState([]);

  /* admin */
  const [adminStats, setAdminStats] = useState(null);
  const [adminWithdrawals, setAdminWithdrawals] = useState([]);
  const [adminNotes, setAdminNotes] = useState({});
  const [adminLoading, setAdminLoading] = useState(false);

  /* referral */
  const [refCode] = useState(() => new URLSearchParams(window.location.search).get("ref") || "");
  const [refCopied, setRefCopied] = useState(false);
  const [signupBonus, setSignupBonus] = useState(0);

  /* streak */
  const [streakBonusNotif, setStreakBonusNotif] = useState(0);

  /* derived */
  const pts = user?.points || 0;
  const ptsRupees = +(pts / 10).toFixed(2);
  const catMap = catStats.reduce((a, c) => { a[c.category] = c; return a; }, {});

  const refreshUser = async () => {
    const d = await api("/auth/me");
    setUser(d.user);
  };
  const refreshCatStats = async () => {
    const d = await api("/quiz/category-stats");
    setCatStats(d.stats || []);
  };

  /* on load: check token */
  useEffect(() => {
    if (!token) { setAuthLoading(false); return; }
    (async () => {
      try {
        const [me, cs] = await Promise.all([api("/auth/me"), api("/quiz/category-stats")]);
        setUser(me.user);
        setCatStats(cs.stats || []);
      } catch {
        localStorage.removeItem("qr_token");
        setToken(null);
      } finally {
        setAuthLoading(false);
      }
    })();
  }, [token]);

  /* tab switch guard */
  useEffect(() => {
    if (!quiz) return;
    const onHide = () => { if (document.hidden) { setSwitchWarn(true); setQuiz(null); } };
    const onBlur = () => { setSwitchWarn(true); setQuiz(null); };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("blur", onBlur);
    return () => { document.removeEventListener("visibilitychange", onHide); window.removeEventListener("blur", onBlur); };
  }, [quiz]);

  /* leaderboard fetch */
  useEffect(() => {
    if (page !== "global") return;
    api("/leaderboard").then(d => setLb(d)).catch(() => {});
  }, [page]);

  useEffect(() => {
    if (page !== "global" || lbTab !== "category") return;
    api(`/leaderboard/category/${lbCat}`).then(d => setLbCatData(d.stats || [])).catch(() => {});
  }, [page, lbTab, lbCat]);

  /* rewards history fetch */
  useEffect(() => {
    if (page !== "rewards" || !user) return;
    api("/withdraw/history").then(d => setWdHistory(d.requests || [])).catch(() => {});
  }, [page, user]);

  /* admin fetch */
  useEffect(() => {
    if (page !== "admin" || !user?.is_admin) return;
    setAdminLoading(true);
    Promise.all([api("/admin/stats"), api("/admin/withdrawals")])
      .then(([stats, wds]) => { setAdminStats(stats); setAdminWithdrawals(wds.requests || []); })
      .catch(() => {})
      .finally(() => setAdminLoading(false));
  }, [page]);

  /* ── AUTH ── */
  const handleAuth = async () => {
    setAuthErr(""); setAuthBusy(true);
    try {
      const endpoint = authMode === "signup" ? "/auth/register" : "/auth/login";
      const body = authMode === "signup"
        ? { name: form.name, email: form.email, password: form.password, ...(refCode ? { ref_code: refCode } : {}) }
        : { email: form.email, password: form.password };
      const d = await api(endpoint, { method: "POST", body });
      localStorage.setItem("qr_token", d.token);
      setToken(d.token);
      setUser(d.user);
      if (authMode === "signup" && d.bonus_points > 0) setSignupBonus(d.bonus_points);
    } catch (e) { setAuthErr(e.message); }
    setAuthBusy(false);
  };

  const logout = () => {
    localStorage.removeItem("qr_token");
    setToken(null); setUser(null); setCatStats([]);
    setPage("dashboard"); setQuiz(null); setResult(null);
  };

  /* ── QUIZ ── */
  const startQuiz = async (catId) => {
    if (!GEMINI_API_KEY) { setLoadErr("Add VITE_GEMINI_API_KEY to Secrets tab. Get it free at aistudio.google.com"); setPage("menu"); return; }
    setLoadErr(""); setLoadingQ(true); setResult(null); setPage("quiz");
    try {
      const questions = await generateQuestions(catId);
      setQuiz({ catId, questions, idx: 0, answers: [] });
    } catch { setLoadErr("Couldn't load questions. Check your API key and internet."); setPage("menu"); }
    setLoadingQ(false);
  };

  const handleAnswer = async (correct) => {
    if (!quiz) return;
    const answers = [...quiz.answers, correct];
    if (answers.length === 10) {
      const score = answers.filter(Boolean).length;
      try {
        const d = await api("/quiz/complete", { method: "POST", body: { category: quiz.catId, score } });
        setUser(d.user);
        await refreshCatStats();
        if (d.streak_bonus > 0) setStreakBonusNotif(d.streak_bonus);
        setResult({ score, pointsEarned: d.pointsEarned, rupeesEarned: d.rupeesEarned, catId: quiz.catId, streakBonus: d.streak_bonus || 0, newStreak: d.new_streak || 0 });
      } catch {
        setResult({ score, pointsEarned: score, rupeesEarned: +(score / 10).toFixed(2), catId: quiz.catId });
      }
      setQuiz(null);
    } else {
      setQuiz({ ...quiz, idx: quiz.idx + 1, answers });
    }
  };

  /* ── WITHDRAWAL ── */
  const doWithdraw = async () => {
    if (pts < 1000) return setWdMsg({ text: "You need at least 1000 points (₹100) to withdraw.", type: "err" });
    if (!upi.trim()) return setWdMsg({ text: "Please enter your UPI ID.", type: "err" });
    setWdLoading(true); setWdMsg({ text: "", type: "" });
    try {
      const d = await api("/withdraw/request", { method: "POST", body: { upi_id: upi } });
      setWdMsg({ text: `✅ ₹${d.amount} (${d.pointsToWithdraw} pts) withdrawal requested to ${d.upi_id}. Pending admin approval.`, type: "ok" });
      setUpi("");
      await refreshUser();
      const hist = await api("/withdraw/history");
      setWdHistory(hist.requests || []);
    } catch (e) { setWdMsg({ text: e.message, type: "err" }); }
    setWdLoading(false);
  };

  /* ── ADMIN ── */
  const handleAdminAction = async (id, status) => {
    try {
      await api(`/admin/withdrawals/${id}`, { method: "PUT", body: { status, admin_note: adminNotes[id] || "" } });
      const [stats, wds] = await Promise.all([api("/admin/stats"), api("/admin/withdrawals")]);
      setAdminStats(stats); setAdminWithdrawals(wds.requests || []);
    } catch (e) { alert(e.message); }
  };

  /* ── LOADING ── */
  if (authLoading) return (
    <div style={{ minHeight: "100vh", background: "#07070e", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      <div style={{ width: 46, height: 46, border: "4px solid #181828", borderTopColor: "#e94560", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
    </div>
  );

  /* ══ AUTH SCREEN ══════════════════════════════════════════════════════════ */
  if (!token || !user) return (
    <div style={{ minHeight: "100vh", background: "#07070e", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 20, fontFamily: "'Nunito', sans-serif" }}>
      <style>{STYLES}</style>
      <div style={{ position: "fixed", top: "15%", left: "50%", transform: "translateX(-50%)", width: 280, height: 280, background: "radial-gradient(circle,rgba(233,69,96,.12) 0%,transparent 70%)", pointerEvents: "none" }} />
      <div style={{ textAlign: "center", marginBottom: 32, animation: "fadeUp .5s ease" }}>
        <div style={{ fontFamily: "'Orbitron', sans-serif", fontSize: 32, fontWeight: 900, color: "#e94560", animation: "glow 3s ease infinite" }}>QuizRupee</div>
        <div style={{ fontSize: 12, color: "#3a3a5a", marginTop: 6, letterSpacing: 3, textTransform: "uppercase" }}>Answer · Learn · Earn</div>
        <div style={{ marginTop: 12, display: "flex", gap: 16, justifyContent: "center", fontSize: 12, color: "#2a2a44" }}>
          <span>⚡ AI Questions</span><span>🎯 1 pt / correct</span><span>💸 Withdraw via UPI</span>
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
        {authMode === "signup" && <Field label="Your Name" placeholder="e.g. Rahul Sharma" value={form.name} onChange={v => setForm(f => ({ ...f, name: v }))} />}
        <Field label="Email" type="email" placeholder="you@gmail.com" value={form.email} onChange={v => setForm(f => ({ ...f, email: v }))} />
        <Field label="Password" type="password" placeholder="Min 6 characters" value={form.password} onChange={v => setForm(f => ({ ...f, password: v }))} onEnter={handleAuth} />
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
        Powered by Gemini AI · Free to play<br />1 pt per correct · 1000 pts = ₹100 · Withdraw via UPI
      </div>
    </div>
  );

  /* ══ MAIN APP SHELL ═══════════════════════════════════════════════════════ */
  const navItems = [
    ["dashboard", "🏠", "Home"],
    ["menu", "🎮", "Play"],
    ["rewards", "💎", "Earn"],
    ["global", "🌍", "Global"],
    ...(user.is_admin ? [["admin", "⚙️", "Admin"]] : []),
  ];

  return (
    <div style={{ minHeight: "100vh", background: "#07070e", color: "#e0e0e0", fontFamily: "'Nunito', sans-serif", display: "flex", flexDirection: "column", maxWidth: 430, margin: "0 auto" }}>
      <style>{STYLES}</style>
      <BannerAd pos="top" />

      {/* ── GLOBAL HEADER ── */}
      <div style={{ padding: "10px 15px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #141428", background: "#09091a", flexShrink: 0 }}>
        <div>
          <div style={{ fontFamily: "'Orbitron', sans-serif", fontSize: 15, fontWeight: 900, color: "#e94560" }}>QuizRupee</div>
          <div style={{ fontSize: 11, color: "#3a3a5a", marginTop: 1 }}>👤 {user.name?.split(" ")[0]} · <span style={{ color: "#e94560", fontWeight: 800 }}>{pts.toLocaleString()} pts</span></div>
        </div>
        <button onClick={logout} style={{ background: "rgba(233,69,96,.12)", border: "1.5px solid #e9456050", borderRadius: 10, color: "#e94560", fontWeight: 900, fontSize: 13, cursor: "pointer", padding: "8px 16px", fontFamily: "inherit" }}>
          Sign Out
        </button>
      </div>

      <div style={{ flex: 1, overflowY: "auto", paddingBottom: 68 }}>

        {/* ══ DASHBOARD ══ */}
        {page === "dashboard" && (
          <div style={{ padding: "18px 15px", animation: "fadeUp .35s ease" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
              <div>
                <div style={{ fontSize: 20, fontWeight: 900 }}>Hey {user.name?.split(" ")[0]} 👋</div>
                <div style={{ fontSize: 12, color: "#444", marginTop: 2 }}>Ready to earn today?</div>
              </div>
              <div style={{ background: "#0c0c1e", borderRadius: 12, padding: "7px 14px", border: "1.5px solid #e9456022", textAlign: "center" }}>
                <div style={{ fontSize: 9, color: "#e94560", fontWeight: 800, letterSpacing: 1 }}>BALANCE</div>
                <div style={{ fontFamily: "'Orbitron', sans-serif", fontSize: 16, fontWeight: 900, color: "#e94560" }}>{pts.toLocaleString()}</div>
                <div style={{ fontSize: 9, color: "#444" }}>= ₹{ptsRupees.toFixed(2)}</div>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 9, marginBottom: 18 }}>
              {[
                ["🎮", catStats.reduce((s, c) => s + (c.played || 0), 0), "QUIZZES", "#e94560"],
                ["✅", catStats.reduce((s, c) => s + (c.total_correct || 0), 0), "CORRECT", "#22c55e"],
                ["🏆", `${pts.toLocaleString()} pts`, "BALANCE", "#f59e0b"],
              ].map(([ic, v, l, c]) => (
                <div key={l} className="card" style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 19 }}>{ic}</div>
                  <div style={{ fontSize: 15, fontWeight: 900, color: c, marginTop: 2 }}>{v}</div>
                  <div style={{ fontSize: 9, color: "#252540", fontWeight: 800, letterSpacing: 1 }}>{l}</div>
                </div>
              ))}
            </div>

            {/* Streak banner */}
            {(user.streak > 0 || streakBonusNotif > 0) && (
              <div style={{ background: "linear-gradient(135deg,rgba(249,115,22,.15),rgba(239,68,68,.08))", border: "1.5px solid #f9731633", borderRadius: 14, padding: "12px 16px", marginBottom: 14, display: "flex", alignItems: "center", gap: 13 }}>
                <div style={{ fontSize: 32, flexShrink: 0 }}>🔥</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 900, fontSize: 15, color: "#f97316" }}>
                    {user.streak} Day Streak!
                    {user.streak >= 7 && <span style={{ fontSize: 12, marginLeft: 6, color: "#f59e0b" }}>🏆 Max!</span>}
                  </div>
                  <div style={{ fontSize: 11, color: "#555", marginTop: 2 }}>
                    Play today to earn <span style={{ color: "#f97316", fontWeight: 800 }}>+{Math.min(user.streak + 1, 7) * 2} bonus pts</span> · Best: {user.longest_streak} days
                  </div>
                </div>
                {streakBonusNotif > 0 && (
                  <div style={{ background: "rgba(249,115,22,.18)", borderRadius: 9, padding: "5px 10px", textAlign: "center", flexShrink: 0 }}>
                    <div style={{ fontSize: 10, color: "#f97316", fontWeight: 800 }}>BONUS</div>
                    <div style={{ fontSize: 15, fontWeight: 900, color: "#f97316" }}>+{streakBonusNotif}</div>
                    <button onClick={() => setStreakBonusNotif(0)} style={{ background: "none", border: "none", color: "#555", fontSize: 11, cursor: "pointer", padding: 0, marginTop: 2, display: "block", width: "100%" }}>✕</button>
                  </div>
                )}
              </div>
            )}

            {signupBonus > 0 && (
              <div style={{ background: "linear-gradient(135deg,rgba(34,197,94,.15),rgba(34,197,94,.05))", border: "1.5px solid #22c55e44", borderRadius: 14, padding: "13px 16px", marginBottom: 14, display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ fontSize: 28, flexShrink: 0 }}>🎁</div>
                <div>
                  <div style={{ fontWeight: 900, color: "#22c55e", fontSize: 14 }}>+{signupBonus} Bonus Points!</div>
                  <div style={{ fontSize: 12, color: "#444", marginTop: 2 }}>You signed up via a referral link. Enjoy your welcome bonus!</div>
                </div>
                <button onClick={() => setSignupBonus(0)} style={{ marginLeft: "auto", background: "none", border: "none", color: "#333", fontSize: 18, cursor: "pointer", flexShrink: 0 }}>✕</button>
              </div>
            )}

            <div className="card" style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: "#252540", letterSpacing: 2, marginBottom: 10 }}>🔗 REFERRAL LINK</div>
              <div style={{ fontSize: 12, color: "#555", marginBottom: 10, lineHeight: 1.6 }}>
                Share your link — friends get <span style={{ color: "#22c55e", fontWeight: 800 }}>+10 pts</span> on signup, you get <span style={{ color: "#f59e0b", fontWeight: 800 }}>+20 pts</span> per referral!
              </div>
              {user.referral_code ? (
                <>
                  <div style={{ background: "#07070e", borderRadius: 10, padding: "10px 13px", fontSize: 12, color: "#e94560", fontFamily: "monospace", marginBottom: 10, wordBreak: "break-all", border: "1px solid #1a1a30" }}>
                    {`${window.location.origin}?ref=${user.referral_code}`}
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => { navigator.clipboard.writeText(`${window.location.origin}?ref=${user.referral_code}`); setRefCopied(true); setTimeout(() => setRefCopied(false), 2000); }}
                      style={{ flex: 1, padding: "10px", borderRadius: 10, background: refCopied ? "rgba(34,197,94,.15)" : "#0c0c1e", border: `1.5px solid ${refCopied ? "#22c55e" : "#252540"}`, color: refCopied ? "#22c55e" : "#aaa", fontWeight: 800, fontSize: 13, cursor: "pointer", fontFamily: "inherit", transition: "all .2s" }}>
                      {refCopied ? "✅ Copied!" : "📋 Copy Link"}
                    </button>
                    {user.referral_count > 0 && (
                      <div style={{ background: "rgba(245,158,11,.1)", border: "1.5px solid #f59e0b33", borderRadius: 10, padding: "10px 14px", fontSize: 12, fontWeight: 800, color: "#f59e0b", whiteSpace: "nowrap" }}>
                        👥 {user.referral_count} referred
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div style={{ fontSize: 12, color: "#444" }}>Log out and back in to generate your link.</div>
              )}
            </div>

            <div style={{ fontSize: 10, fontWeight: 800, color: "#252540", letterSpacing: 2, textTransform: "uppercase", marginBottom: 10 }}>Category Records</div>
            {CATEGORIES.map(cat => {
              const cs = catMap[cat.id];
              const acc = cs ? Math.round((cs.total_correct / (cs.played * 10)) * 100) : 0;
              return (
                <div key={cat.id} className="card" style={{ marginBottom: 9 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: cs ? 10 : 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ width: 36, height: 36, borderRadius: 10, background: `${cat.color}18`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, border: `1px solid ${cat.color}25`, flexShrink: 0 }}>{cat.icon}</div>
                      <div>
                        <div style={{ fontWeight: 800, fontSize: 14 }}>{cat.label}</div>
                        <div style={{ fontSize: 11, color: "#444", marginTop: 1 }}>{cs ? `${cs.played} round${cs.played > 1 ? "s" : ""} · Best ${cs.best_score}/10` : "Not played yet"}</div>
                      </div>
                    </div>
                    {cs && <div style={{ textAlign: "right" }}><div style={{ fontWeight: 900, color: "#e94560", fontSize: 14 }}>{cs.points_earned} pts</div><div style={{ fontSize: 10, color: "#444" }}>{acc}% acc</div></div>}
                  </div>
                  {cs && <>
                    <div className="pbar" style={{ marginBottom: 8 }}><div className="pfill" style={{ width: `${acc}%` }} /></div>
                    {(cs.history || []).map((r, i) => (
                      <div key={i} className="hrow">
                        <span style={{ color: "#444" }}>{r.date}</span>
                        <span style={{ fontWeight: 800, color: r.score >= 7 ? "#22c55e" : r.score >= 5 ? "#f59e0b" : "#e94560" }}>{r.score}/10</span>
                        <span style={{ color: "#e94560", fontWeight: 800 }}>+{r.points_earned} pts</span>
                      </div>
                    ))}
                  </>}
                </div>
              );
            })}
          </div>
        )}

        {/* ══ PLAY MENU ══ */}
        {page === "menu" && !quiz && !result && (
          <div style={{ padding: "18px 15px", animation: "fadeUp .35s ease" }}>
            <div style={{ fontFamily: "'Orbitron', sans-serif", fontSize: 17, fontWeight: 900, color: "#e94560", marginBottom: 4 }}>Choose Category</div>
            <div style={{ fontSize: 12, color: "#444", marginBottom: 6 }}>Gemini AI generates fresh questions every round</div>
            {loadErr && <div style={{ background: "rgba(239,68,68,.1)", border: "1px solid #ef444430", borderRadius: 12, padding: "11px 14px", marginBottom: 14, fontSize: 13, color: "#ef4444", fontWeight: 700 }}>⚠️ {loadErr}</div>}
            <div style={{ fontSize: 11, color: "#252540", marginBottom: 14, padding: "9px 13px", background: "#0c0c1e", borderRadius: 10, border: "1px solid #181828", lineHeight: 1.7 }}>
              💡 10 questions · 1 pt per correct answer · 10 pts = ₹1 · Don't switch tabs!
            </div>
            {CATEGORIES.map(cat => {
              const cs = catMap[cat.id];
              return (
                <div key={cat.id} onClick={() => !loadingQ && startQuiz(cat.id)}
                  style={{ cursor: loadingQ ? "not-allowed" : "pointer", background: "#0c0c1e", borderRadius: 16, padding: "13px 15px", marginBottom: 9, border: "1.5px solid #181828", display: "flex", alignItems: "center", gap: 13, transition: "all .2s", opacity: loadingQ ? .5 : 1 }}
                  onMouseEnter={e => { if (!loadingQ) { e.currentTarget.style.borderColor = cat.color; e.currentTarget.style.background = `${cat.color}12`; } }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = "#181828"; e.currentTarget.style.background = "#0c0c1e"; }}>
                  <div style={{ width: 46, height: 46, borderRadius: 13, background: `${cat.color}18`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 23, border: `1.5px solid ${cat.color}28`, flexShrink: 0 }}>{cat.icon}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 800, fontSize: 15 }}>{cat.label}</div>
                    <div style={{ fontSize: 11, color: "#444", marginTop: 2 }}>{cs ? `Best: ${cs.best_score}/10 · Played ${cs.played}×` : "Tap to play"}</div>
                  </div>
                  <div style={{ color: "#252540", fontSize: 15 }}>▶</div>
                </div>
              );
            })}
          </div>
        )}

        {/* ══ QUIZ LOADING ══ */}
        {page === "quiz" && loadingQ && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 300, padding: 40 }}>
            <div style={{ width: 46, height: 46, border: "4px solid #181828", borderTopColor: "#e94560", borderRadius: "50%", animation: "spin 1s linear infinite", marginBottom: 20 }} />
            <div style={{ fontFamily: "'Orbitron', sans-serif", fontSize: 13, color: "#e94560", fontWeight: 900 }}>Gemini AI Generating...</div>
            <div style={{ fontSize: 12, color: "#444", marginTop: 6 }}>Fresh questions just for you ✨</div>
          </div>
        )}

        {/* ══ ACTIVE QUIZ ══ */}
        {page === "quiz" && quiz && !loadingQ && (() => {
          const cat = CATEGORIES.find(c => c.id === quiz.catId);
          const q = quiz.questions[quiz.idx];
          return (
            <div style={{ padding: "18px 15px", animation: "fadeUp .3s ease" }}>
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
            </div>
          );
        })()}

        {/* ══ RESULT ══ */}
        {result && page === "quiz" && (
          <div style={{ padding: "30px 15px", textAlign: "center", animation: "pop .4s ease" }}>
            <div style={{ fontSize: 66, marginBottom: 12 }}>{result.score >= 8 ? "🏆" : result.score >= 5 ? "⭐" : "💪"}</div>
            <div style={{ fontFamily: "'Orbitron', sans-serif", fontSize: 21, fontWeight: 900, marginBottom: 8, color: result.score >= 8 ? "#f59e0b" : result.score >= 5 ? "#3b82f6" : "#e94560" }}>
              {result.score >= 8 ? "Brilliant!" : result.score >= 5 ? "Good Job!" : "Keep Going!"}
            </div>
            <div style={{ fontSize: 15, color: "#555", marginBottom: 22 }}>
              <strong style={{ color: "#fff", fontSize: 22 }}>{result.score}</strong> / 10 correct
            </div>
            <div style={{ background: "linear-gradient(135deg,#10102a,#0a0a1e)", borderRadius: 20, padding: 22, marginBottom: 14, border: "1.5px solid #e9456033" }}>
              <div style={{ fontSize: 12, color: "#555", marginBottom: 4 }}>Points Earned</div>
              <div style={{ fontFamily: "'Orbitron', sans-serif", fontSize: 40, fontWeight: 900, color: "#e94560" }}>+{result.pointsEarned} pts</div>
              {result.streakBonus > 0 && (
                <div style={{ marginTop: 10, background: "rgba(249,115,22,.12)", borderRadius: 10, padding: "8px 14px", display: "inline-flex", alignItems: "center", gap: 7 }}>
                  <span style={{ fontSize: 18 }}>🔥</span>
                  <span style={{ fontSize: 13, fontWeight: 900, color: "#f97316" }}>+{result.streakBonus} streak bonus</span>
                  <span style={{ fontSize: 11, color: "#555" }}>({result.newStreak} day streak)</span>
                </div>
              )}
              <div style={{ fontSize: 13, color: "#444", marginTop: 8 }}>Your balance: {pts.toLocaleString()} pts</div>
            </div>
            <div style={{ background: "#0c0c1e", borderRadius: 14, padding: "11px 16px", marginBottom: 22, border: "1px solid #181828", fontSize: 12, color: "#444" }}>
              🎯 {1000 - pts > 0 ? `${(1000 - pts).toLocaleString()} more points to unlock ₹100 withdrawal` : "🎉 You can withdraw now!"}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 11 }}>
              <button onClick={() => { setResult(null); setPage("menu"); }} style={{ padding: 14, borderRadius: 13, background: "#0c0c1e", color: "#aaa", fontSize: 14, fontWeight: 800, border: "1.5px solid #181828", cursor: "pointer", fontFamily: "inherit" }}>Other Categories</button>
              <button onClick={() => startQuiz(result.catId)} style={{ padding: 14, borderRadius: 13, background: "linear-gradient(135deg,#e94560,#b91c4a)", color: "#fff", fontSize: 14, fontWeight: 800, border: "none", cursor: "pointer", fontFamily: "inherit" }}>Play Again ▶</button>
            </div>
          </div>
        )}

        {/* ══ REWARDS ══ */}
        {page === "rewards" && (
          <div style={{ padding: "18px 15px", animation: "fadeUp .35s ease" }}>
            <div style={{ fontFamily: "'Orbitron', sans-serif", fontSize: 17, fontWeight: 900, color: "#f59e0b", marginBottom: 18 }}>💎 Rewards</div>

            <div style={{ background: "linear-gradient(135deg,#10102a,#0a0a1e)", borderRadius: 20, padding: 22, marginBottom: 14, border: "1px solid #f59e0b22", textAlign: "center" }}>
              <div style={{ fontSize: 12, color: "#555", marginBottom: 4 }}>Your Points Balance</div>
              <div style={{ fontFamily: "'Orbitron', sans-serif", fontSize: 38, fontWeight: 900, color: "#e94560" }}>{pts.toLocaleString()}</div>
              <div style={{ fontSize: 14, color: "#f59e0b", fontWeight: 800, marginTop: 4 }}>= ₹{ptsRupees.toFixed(2)}</div>
              <div style={{ height: 6, borderRadius: 3, background: "#181828", margin: "14px 0 6px", overflow: "hidden" }}>
                <div style={{ height: "100%", borderRadius: 3, width: `${Math.min((pts / 1000) * 100, 100)}%`, background: pts >= 1000 ? "linear-gradient(90deg,#f59e0b,#e67e22)" : "linear-gradient(90deg,#e94560,#b91c4a)", transition: "width .5s" }} />
              </div>
              <div style={{ fontSize: 11, color: "#444" }}>
                {pts < 1000 ? `${(1000 - pts).toLocaleString()} more points to unlock withdrawal` : "🎉 Ready to withdraw!"}
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9, marginBottom: 14 }}>
              <div className="card" style={{ textAlign: "center" }}>
                <div style={{ fontSize: 20 }}>📊</div>
                <div style={{ fontSize: 14, fontWeight: 900, color: "#22c55e" }}>₹{parseFloat(user.total_earned || 0).toFixed(2)}</div>
                <div style={{ fontSize: 9, color: "#252540", fontWeight: 800, letterSpacing: 1 }}>TOTAL EARNED</div>
              </div>
              <div className="card" style={{ textAlign: "center" }}>
                <div style={{ fontSize: 20 }}>🏦</div>
                <div style={{ fontSize: 14, fontWeight: 900, color: "#3b82f6" }}>₹{parseFloat(user.total_withdrawn || 0).toFixed(2)}</div>
                <div style={{ fontSize: 9, color: "#252540", fontWeight: 800, letterSpacing: 1 }}>WITHDRAWN</div>
              </div>
            </div>

            <div className="card" style={{ marginBottom: 14 }}>
              <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 4 }}>Withdraw via UPI</div>
              <div style={{ fontSize: 11, color: "#444", marginBottom: 13 }}>Min: 1000 pts = ₹100 · Processed by admin within 24–48 hrs</div>
              <input className="inp" placeholder="Your UPI ID (e.g. name@okaxis)" value={upi} onChange={e => setUpi(e.target.value)} style={{ marginBottom: 11 }} />
              <button onClick={doWithdraw} disabled={wdLoading || pts < 1000} style={{ width: "100%", padding: 14, borderRadius: 12, background: pts >= 1000 && !wdLoading ? "linear-gradient(135deg,#f59e0b,#e67e22)" : "#181828", color: pts >= 1000 && !wdLoading ? "#000" : "#444", fontWeight: 900, fontSize: 15, border: "none", cursor: pts >= 1000 && !wdLoading ? "pointer" : "not-allowed", fontFamily: "inherit" }}>
                {wdLoading ? "Processing..." : pts >= 1000 ? `Withdraw ₹${Math.floor(pts / 1000) * 100} (${Math.floor(pts / 1000) * 1000} pts)` : `Need ${(1000 - pts).toLocaleString()} more points`}
              </button>
              {wdMsg.text && <div style={{ marginTop: 10, fontSize: 13, fontWeight: 700, color: wdMsg.type === "ok" ? "#22c55e" : "#e94560", lineHeight: 1.5 }}>{wdMsg.text}</div>}
            </div>

            <div className="card" style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: "#252540", letterSpacing: 2, marginBottom: 12 }}>HOW IT WORKS</div>
              {[["🎯", "Each correct answer", "1 point"], ["📐", "Points to rupees", "10 pts = ₹1"], ["💰", "Minimum withdrawal", "1000 pts = ₹100"], ["📱", "Stay in app during quiz", "or it restarts"], ["⏱️", "Processing time", "24–48 hours"]].map(([ic, l, v]) => (
                <div key={l} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 0", borderBottom: "1px solid #111120", fontSize: 13 }}>
                  <span style={{ color: "#444" }}>{ic} {l}</span>
                  <span style={{ color: "#f59e0b", fontWeight: 800, flexShrink: 0, marginLeft: 8 }}>{v}</span>
                </div>
              ))}
            </div>

            {wdHistory.length > 0 && (
              <div className="card">
                <div style={{ fontSize: 10, fontWeight: 800, color: "#252540", letterSpacing: 2, marginBottom: 12 }}>WITHDRAWAL HISTORY</div>
                {wdHistory.map(r => {
                  const statusColor = r.status === "approved" ? "#22c55e" : r.status === "rejected" ? "#ef4444" : "#f59e0b";
                  return (
                    <div key={r.id} style={{ padding: "10px 0", borderBottom: "1px solid #111120" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 800 }}>₹{parseFloat(r.amount).toFixed(2)}</div>
                          <div style={{ fontSize: 11, color: "#444" }}>{r.upi_id} · {r.points_used} pts</div>
                          {r.admin_note && <div style={{ fontSize: 11, color: "#555", marginTop: 2, fontStyle: "italic" }}>{r.admin_note}</div>}
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <span className="tag" style={{ background: `${statusColor}18`, color: statusColor, border: `1px solid ${statusColor}30` }}>{r.status.toUpperCase()}</span>
                          <div style={{ fontSize: 10, color: "#444", marginTop: 4 }}>{new Date(r.requested_at).toLocaleDateString("en-IN")}</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ══ GLOBAL LEADERBOARD ══ */}
        {page === "global" && (
          <div style={{ padding: "18px 15px", animation: "fadeUp .35s ease" }}>
            <div style={{ fontFamily: "'Orbitron', sans-serif", fontSize: 17, fontWeight: 900, color: "#3b82f6", marginBottom: 4 }}>🌍 Global Stats</div>
            <div style={{ fontSize: 12, color: "#444", marginBottom: 16 }}>Rankings across all players</div>
            <div style={{ display: "flex", gap: 8, marginBottom: 16, overflowX: "auto", paddingBottom: 4 }}>
              {[["overall", "🏆 Overall"], ["earned", "💰 Earners"], ["category", "📂 Category"]].map(([id, label]) => (
                <button key={id} onClick={() => setLbTab(id)} style={{ padding: "8px 15px", borderRadius: 20, border: "1.5px solid", borderColor: lbTab === id ? "#3b82f6" : "#181828", background: lbTab === id ? "rgba(59,130,246,.14)" : "transparent", color: lbTab === id ? "#3b82f6" : "#444", fontWeight: 800, fontSize: 12, cursor: "pointer", whiteSpace: "nowrap", fontFamily: "inherit", flexShrink: 0, transition: "all .2s" }}>
                  {label}
                </button>
              ))}
            </div>

            {lbTab === "overall" && (
              <div className="card">
                <div style={{ fontSize: 10, fontWeight: 800, color: "#252540", letterSpacing: 2, marginBottom: 12 }}>TOP PLAYERS — CORRECT ANSWERS</div>
                {lb.overall.length === 0
                  ? <div style={{ color: "#444", textAlign: "center", padding: "24px 0", fontSize: 14 }}>No players yet — be the first! 🎉</div>
                  : lb.overall.map((u, i) => (
                    <div key={u.id} className="lrow">
                      <div style={{ width: 26, textAlign: "center", fontSize: i < 3 ? 20 : 12, fontWeight: 900, color: i < 3 ? "#f59e0b" : "#252540", flexShrink: 0 }}>{i < 3 ? MEDAL[i] : `#${i + 1}`}</div>
                      <div style={{ flex: 1 }}><div style={{ fontWeight: 800, fontSize: 14 }}>{u.name}</div><div style={{ fontSize: 11, color: "#444" }}>{u.total_played} rounds played</div></div>
                      <div style={{ fontWeight: 900, fontSize: 14, color: "#22c55e" }}>{u.total_correct} ✅</div>
                    </div>
                  ))}
              </div>
            )}

            {lbTab === "earned" && (
              <div className="card">
                <div style={{ fontSize: 10, fontWeight: 800, color: "#252540", letterSpacing: 2, marginBottom: 12 }}>TOP EARNERS</div>
                {lb.earners.length === 0
                  ? <div style={{ color: "#444", textAlign: "center", padding: "24px 0", fontSize: 14 }}>No earners yet!</div>
                  : lb.earners.map((u, i) => (
                    <div key={u.id} className="lrow">
                      <div style={{ width: 26, textAlign: "center", fontSize: i < 3 ? 20 : 12, fontWeight: 900, color: i < 3 ? "#f59e0b" : "#252540", flexShrink: 0 }}>{i < 3 ? MEDAL[i] : `#${i + 1}`}</div>
                      <div style={{ flex: 1 }}><div style={{ fontWeight: 800, fontSize: 14 }}>{u.name}</div><div style={{ fontSize: 11, color: "#444" }}>{u.total_correct} correct · {u.total_played} rounds</div></div>
                      <div style={{ fontWeight: 900, fontSize: 14, color: "#f59e0b" }}>₹{parseFloat(u.total_earned).toFixed(2)}</div>
                    </div>
                  ))}
              </div>
            )}

            {lbTab === "category" && (
              <>
                <div style={{ display: "flex", gap: 7, overflowX: "auto", paddingBottom: 10, marginBottom: 13 }}>
                  {CATEGORIES.map(cat => (
                    <button key={cat.id} onClick={() => setLbCat(cat.id)} style={{ padding: "7px 13px", borderRadius: 20, border: "1.5px solid", borderColor: lbCat === cat.id ? cat.color : "#181828", background: lbCat === cat.id ? `${cat.color}15` : "transparent", color: lbCat === cat.id ? cat.color : "#444", fontWeight: 800, fontSize: 11, cursor: "pointer", whiteSpace: "nowrap", fontFamily: "inherit", flexShrink: 0, transition: "all .2s" }}>
                      {cat.icon} {cat.label}
                    </button>
                  ))}
                </div>
                <div className="card">
                  <div style={{ fontSize: 10, fontWeight: 800, color: "#252540", letterSpacing: 2, marginBottom: 12 }}>
                    {CATEGORIES.find(c => c.id === lbCat)?.icon} TOP IN {lbCat.toUpperCase()}
                  </div>
                  {lbCatData.length === 0
                    ? <div style={{ color: "#444", textAlign: "center", padding: "24px 0", fontSize: 14 }}>No one has played this yet!</div>
                    : lbCatData.map((u, i) => (
                      <div key={i} className="lrow">
                        <div style={{ width: 26, textAlign: "center", fontSize: i < 3 ? 20 : 12, fontWeight: 900, color: i < 3 ? "#f59e0b" : "#252540", flexShrink: 0 }}>{i < 3 ? MEDAL[i] : `#${i + 1}`}</div>
                        <div style={{ flex: 1 }}><div style={{ fontWeight: 800, fontSize: 14 }}>{u.name}</div><div style={{ fontSize: 11, color: "#444" }}>{u.played} rounds · Best {u.best_score}/10</div></div>
                        <div style={{ fontWeight: 900, fontSize: 14, color: "#22c55e" }}>{u.total_correct} ✅</div>
                      </div>
                    ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* ══ ADMIN PANEL ══ */}
        {page === "admin" && user.is_admin && (
          <div style={{ padding: "18px 15px", animation: "fadeUp .35s ease" }}>
            <div style={{ fontFamily: "'Orbitron', sans-serif", fontSize: 17, fontWeight: 900, color: "#a855f7", marginBottom: 18 }}>⚙️ Admin Panel</div>

            {adminLoading && <div style={{ textAlign: "center", color: "#444", padding: 40 }}>Loading...</div>}

            {adminStats && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9, marginBottom: 18 }}>
                {[
                  ["👥", adminStats.total_users, "USERS", "#3b82f6"],
                  ["🎮", adminStats.total_quizzes, "QUIZZES", "#22c55e"],
                  ["⏳", adminStats.pending_withdrawals, "PENDING", "#f59e0b"],
                  ["💸", `₹${parseFloat(adminStats.total_paid_out || 0).toFixed(0)}`, "PAID OUT", "#e94560"],
                ].map(([ic, v, l, c]) => (
                  <div key={l} className="card" style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 22 }}>{ic}</div>
                    <div style={{ fontSize: 20, fontWeight: 900, color: c, marginTop: 2 }}>{v}</div>
                    <div style={{ fontSize: 9, color: "#252540", fontWeight: 800, letterSpacing: 1 }}>{l}</div>
                  </div>
                ))}
              </div>
            )}

            <div style={{ fontSize: 10, fontWeight: 800, color: "#252540", letterSpacing: 2, marginBottom: 12 }}>WITHDRAWAL REQUESTS</div>

            {adminWithdrawals.length === 0 && !adminLoading && (
              <div className="card" style={{ textAlign: "center", color: "#444", padding: "24px 0" }}>No withdrawal requests yet.</div>
            )}

            {adminWithdrawals.map(r => {
              const statusColor = r.status === "approved" ? "#22c55e" : r.status === "rejected" ? "#ef4444" : "#f59e0b";
              return (
                <div key={r.id} className="card" style={{ marginBottom: 10, border: r.status === "pending" ? "1px solid #f59e0b33" : "1px solid #181828" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                    <div>
                      <div style={{ fontWeight: 900, fontSize: 15 }}>{r.name}</div>
                      <div style={{ fontSize: 11, color: "#444" }}>{r.email}</div>
                    </div>
                    <span className="tag" style={{ background: `${statusColor}18`, color: statusColor, border: `1px solid ${statusColor}30` }}>{r.status.toUpperCase()}</span>
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
                    <div className="card" style={{ flex: 1, padding: "8px 12px", minWidth: 100 }}>
                      <div style={{ fontSize: 9, color: "#444", fontWeight: 800 }}>AMOUNT</div>
                      <div style={{ fontSize: 16, fontWeight: 900, color: "#f59e0b" }}>₹{parseFloat(r.amount).toFixed(2)}</div>
                      <div style={{ fontSize: 10, color: "#444" }}>{r.points_used} pts</div>
                    </div>
                    <div className="card" style={{ flex: 1, padding: "8px 12px", minWidth: 100 }}>
                      <div style={{ fontSize: 9, color: "#444", fontWeight: 800 }}>UPI ID</div>
                      <div style={{ fontSize: 12, fontWeight: 800, color: "#e0e0e0", wordBreak: "break-all" }}>{r.upi_id}</div>
                    </div>
                  </div>
                  <div style={{ fontSize: 11, color: "#444", marginBottom: r.status === "pending" ? 10 : 0 }}>
                    Requested: {new Date(r.requested_at).toLocaleString("en-IN")}
                    {r.processed_at && <span> · Processed: {new Date(r.processed_at).toLocaleString("en-IN")}</span>}
                  </div>
                  {r.admin_note && <div style={{ fontSize: 11, color: "#555", fontStyle: "italic", marginBottom: 8 }}>Note: {r.admin_note}</div>}
                  {r.status === "pending" && (
                    <div>
                      <input className="inp" placeholder="Note (optional — e.g. 'Payment sent' or rejection reason)" value={adminNotes[r.id] || ""} onChange={e => setAdminNotes(n => ({ ...n, [r.id]: e.target.value }))} style={{ marginBottom: 8, fontSize: 13, padding: "10px 14px" }} />
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                        <button onClick={() => handleAdminAction(r.id, "approved")} style={{ padding: "10px", borderRadius: 10, background: "rgba(34,197,94,.15)", border: "1.5px solid #22c55e", color: "#22c55e", fontWeight: 900, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>✅ Approve</button>
                        <button onClick={() => handleAdminAction(r.id, "rejected")} style={{ padding: "10px", borderRadius: 10, background: "rgba(239,68,68,.15)", border: "1.5px solid #ef4444", color: "#ef4444", fontWeight: 900, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>❌ Reject</button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

      </div>

      <BannerAd pos="bottom" />

      {/* ── NAV BAR ── */}
      <nav className="nav">
        {navItems.map(([id, ic, lbl]) => (
          <button key={id} className={`nb ${page === id ? "on" : ""}`} onClick={() => { if (!quiz) { setResult(null); setPage(id); } }} style={{ opacity: quiz ? .35 : 1 }}>
            <span>{ic}</span><small>{lbl}</small>
          </button>
        ))}
      </nav>

      {/* ── SWITCH WARNING ── */}
      {switchWarn && (
        <div className="overlay">
          <div className="modal">
            <div style={{ fontSize: 50, marginBottom: 14 }}>⚠️</div>
            <div style={{ fontFamily: "'Orbitron', sans-serif", fontSize: 15, fontWeight: 900, color: "#e94560", marginBottom: 10 }}>Quiz Restarted!</div>
            <p style={{ fontSize: 14, color: "#555", lineHeight: 1.65, marginBottom: 22 }}>Switching apps during the quiz restarts the round. Stay in the app to keep your progress.</p>
            <button onClick={() => { setSwitchWarn(false); setPage("menu"); }} style={{ width: "100%", padding: 14, borderRadius: 13, background: "linear-gradient(135deg,#e94560,#b91c4a)", color: "#fff", fontWeight: 900, fontSize: 16, border: "none", cursor: "pointer", fontFamily: "inherit" }}>
              Got It — Back to Menu
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
