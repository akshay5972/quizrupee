 import { useState, useEffect, useRef } from "react";

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
  { id: "puzzle",        label: "Puzzle",         icon: "🧩", color: "#EC4899" },
  { id: "tricky",        label: "Tricky",         icon: "🤔", color: "#FACC15" },
  { id: "logical",       label: "Logical",        icon: "🧠", color: "#06B6D4" },
];
const MEDAL = ["🥇", "🥈", "🥉"];
const COUNTRIES = [
  "India","United States","United Kingdom","Canada","Australia","United Arab Emirates","Singapore","Saudi Arabia","Qatar","Oman","Kuwait","Bahrain",
  "Pakistan","Bangladesh","Sri Lanka","Nepal","Bhutan","Maldives","Afghanistan",
  "Germany","France","Italy","Spain","Netherlands","Belgium","Sweden","Norway","Denmark","Finland","Ireland","Switzerland","Austria","Portugal","Greece","Poland","Russia","Ukraine","Turkey",
  "China","Japan","South Korea","Thailand","Vietnam","Indonesia","Malaysia","Philippines","Hong Kong","Taiwan","Mongolia",
  "Brazil","Argentina","Chile","Mexico","Colombia","Peru","Venezuela",
  "South Africa","Nigeria","Kenya","Egypt","Morocco","Ghana","Ethiopia","Tanzania","Uganda",
  "New Zealand","Fiji",
  "Israel","Iran","Iraq","Jordan","Lebanon",
  "Other",
];
const AVATAR_URL = (seed, gender) => {
  const safeSeed = encodeURIComponent(seed || "guest");
  const opts = gender === "female"
    ? "&hair=longHair01,longHair02,longHair03,longHairBigHair,longHairCurly,longHairCurvy,longHairStraight"
    : gender === "male"
    ? "&hair=shortHair01,shortHair02,shortHair03,shortHairShortFlat,shortHairShortRound,shortHairTheCaesar"
    : "";
  return `https://api.dicebear.com/9.x/avataaars/svg?seed=${safeSeed}${opts}`;
};
function Avatar({ seed, gender, size = 56, ring = "#1a1a30" }) {
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", background: "#0c0c1e", border: `2px solid ${ring}`, overflow: "hidden", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
      {seed
        ? <img src={AVATAR_URL(seed, gender)} alt="avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        : <span style={{ fontSize: size * 0.5, color: "#3a3a5a" }}>👤</span>}
    </div>
  );
}
function Select({ label, value, onChange, options, placeholder = "Select..." }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ fontSize: 10, fontWeight: 800, color: "#3a3a5a", letterSpacing: 1.5, display: "block", marginBottom: 6, textTransform: "uppercase" }}>{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)}
        style={{ width: "100%", padding: "12px 16px", background: "#07070e", border: "1.5px solid #1a2238", borderRadius: 12, color: value ? "#e0e0e0" : "#3a3a5a", fontSize: 15, fontFamily: "inherit", outline: "none", boxSizing: "border-box", appearance: "none" }}>
        <option value="">{placeholder}</option>
        {options.map(o => <option key={o} value={o} style={{ color: "#e0e0e0", background: "#07070e" }}>{o}</option>)}
      </select>
    </div>
  );
}
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

/* ── QUESTION BANK (server-side cache, per-user no-repeat) ─────────────── */
const generateQuestions = async (categoryId) => {
  const data = await api("/quiz/generate", { method: "POST", body: { category: categoryId } });
  if (!data.questions) throw new Error(data.error || "No questions returned");
  return data.questions;
};

/* ── SMALL COMPONENTS ───────────────────────────────────────────────────── */
const BannerAd = ({ pos }) => (
  <div style={{ width: "100%", height: 46, background: "linear-gradient(90deg,#09090f,#10102a,#09090f)", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, borderTop: pos === "bottom" ? "1px solid #1a1a30" : "none", borderBottom: pos === "top" ? "1px solid #1a1a30" : "none", flexShrink: 0 }}>
    <span style={{ fontSize: 13 }}>📢</span>
    <span style={{ color: "#252540", fontSize: 10, fontWeight: 800, letterSpacing: 3, textTransform: "uppercase" }}>Advertisement · Banner {pos === "top" ? "Top" : "Bottom"}</span>
  </div>
);

function AnswerBtn({ text, isCorrect, onAnswer, onLock, locked }) {
  const [state, setState] = useState("idle");
  const [done, setDone] = useState(false);
  const click = () => {
    if (done || locked) return;
    setDone(true);
    setState(isCorrect ? "correct" : "wrong");
    onLock?.();
    setTimeout(() => { onAnswer(isCorrect); }, 780);
  };
  const styles = { idle: { bg: "#0e1420", border: "#1e2a4a", color: "#ccc" }, correct: { bg: "rgba(34,197,94,.14)", border: "#22c55e", color: "#22c55e" }, wrong: { bg: "rgba(239,68,68,.14)", border: "#ef4444", color: "#ef4444" } }[state];
  const disabled = done || locked;
  return (
    <button onClick={click} disabled={disabled} style={{ width: "100%", padding: "13px 16px", borderRadius: 13, border: `2px solid ${styles.border}`, background: styles.bg, color: styles.color, fontSize: 14, fontFamily: "inherit", cursor: disabled ? "default" : "pointer", textAlign: "left", fontWeight: 700, display: "flex", alignItems: "center", gap: 10, transition: "all .2s" }}>
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
  const [form, setForm] = useState({ name: "", email: "", password: "", gender: "", country: "" });
  const [authErr, setAuthErr] = useState("");
  const [authBusy, setAuthBusy] = useState(false);

  /* nav */
  const [page, setPage] = useState("dashboard");

  /* category stats */
  const [catStats, setCatStats] = useState([]);

  /* quiz */
  const [quiz, setQuiz] = useState(null);
  const [qLocked, setQLocked] = useState(false);
  const [result, setResult] = useState(null);
  const [loadingQ, setLoadingQ] = useState(false);
  const [loadErr, setLoadErr] = useState("");

  // Reset the per-question answer lock whenever the question changes (or quiz ends).
  useEffect(() => { setQLocked(false); }, [quiz?.idx, quiz === null]);
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
  const [qbStats, setQbStats] = useState(null);
  const [qbMode, setQbMode] = useState("add");
  const [qbUploading, setQbUploading] = useState(false);
  const [qbMsg, setQbMsg] = useState(null);
  const qbFileRef = useRef(null);

  /* side menu / profile / help / reports */
  const [sideOpen, setSideOpen] = useState(false);
  const [profileEdit, setProfileEdit] = useState({ gender: "", country: "" });
  const [profileMsg, setProfileMsg] = useState("");
  const [profileBusy, setProfileBusy] = useState(false);
  const [helpMsg, setHelpMsg] = useState("");
  const [helpStatus, setHelpStatus] = useState("");
  const [helpBusy, setHelpBusy] = useState(false);
  const [reports, setReports] = useState([]);
  const [reportsFilter, setReportsFilter] = useState("open");
  const [reportsCounts, setReportsCounts] = useState({ open: 0, resolved: 0 });

  /* friends / follows */
  const [friendsTab, setFriendsTab] = useState("friends");
  const [friendsList, setFriendsList] = useState([]);
  const [friendsLoading, setFriendsLoading] = useState(false);
  const [friendCounts, setFriendCounts] = useState({ friends: 0, following: 0, followers: 0 });
  const [searchQ, setSearchQ] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searchBusy, setSearchBusy] = useState(false);
  const [viewProfile, setViewProfile] = useState(null);
  const [viewBusy, setViewBusy] = useState(false);

  /* referral */
  const [refCode] = useState(() => new URLSearchParams(window.location.search).get("ref") || "");
  const [refCopied, setRefCopied] = useState(false);
  const [signupBonus, setSignupBonus] = useState(0);

  /* streak */
  const [streakBonusNotif, setStreakBonusNotif] = useState(0);

  /* ads & greed */
  const MAX_ADS = 5;
  const [adWatching, setAdWatching] = useState(false);
  const [adCountdown, setAdCountdown] = useState(5);
  const [adWatchesToday, setAdWatchesToday] = useState(() => {
    try {
      const s = JSON.parse(localStorage.getItem('qr_ads') || '{}');
      return s.date === new Date().toDateString() ? (s.count || 0) : 0;
    } catch { return 0; }
  });
  const [milestone, setMilestone] = useState(null);

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

  /* sync profile editor when opening profile page */
  useEffect(() => {
    if (page === "profile") {
      setProfileEdit({ gender: user?.gender || "", country: user?.country || "" });
      setProfileMsg("");
      api("/follows/me/counts").then(c => setFriendCounts(c)).catch(() => {});
    }
    if (page === "help") setHelpStatus("");
  }, [page, user?.gender, user?.country]);

  /* admin reports fetch */
  useEffect(() => {
    if (page !== "admin" || !user?.is_admin) return;
    api(`/admin/reports?status=${reportsFilter}`)
      .then(d => { setReports(d.reports || []); setReportsCounts(d.counts || { open: 0, resolved: 0 }); })
      .catch(() => {});
  }, [page, reportsFilter, user?.is_admin]);

  /* fetch friends/follows lists */
  const loadFriendsList = async (tab = friendsTab) => {
    setFriendsLoading(true);
    try {
      const path = tab === "friends" ? "/follows/me/friends"
                 : tab === "following" ? "/follows/me/following"
                 : tab === "followers" ? "/follows/me/followers" : null;
      if (path) {
        const d = await api(path);
        setFriendsList(d.users || []);
      }
      const c = await api("/follows/me/counts");
      setFriendCounts(c);
    } catch {}
    setFriendsLoading(false);
  };

  useEffect(() => {
    if (page !== "friends" || !user) return;
    if (friendsTab === "find") return;
    loadFriendsList(friendsTab);
  }, [page, friendsTab, user?.id]);

  /* user search (debounced) */
  useEffect(() => {
    if (page !== "friends" || friendsTab !== "find") return;
    const q = searchQ.trim();
    if (q.length < 2) { setSearchResults([]); return; }
    setSearchBusy(true);
    const t = setTimeout(() => {
      api(`/follows/search?q=${encodeURIComponent(q)}`)
        .then(d => setSearchResults(d.users || []))
        .catch(() => setSearchResults([]))
        .finally(() => setSearchBusy(false));
    }, 350);
    return () => clearTimeout(t);
  }, [searchQ, friendsTab, page]);

  const openUserProfile = async (userId) => {
    setViewProfile({ loading: true, id: userId });
    setViewBusy(false);
    try {
      const d = await api(`/profile/${userId}`);
      setViewProfile(d.profile);
    } catch (e) {
      setViewProfile({ error: e.message, id: userId });
    }
  };

  const toggleFollow = async (target, currentlyFollowing) => {
    setViewBusy(true);
    // optimistic update — flip i_follow in any list/modal rendering this user
    const flip = (u) => u.id === target.id ? { ...u, i_follow: !currentlyFollowing,
      follower_count: Math.max(0, (u.follower_count ?? 0) + (currentlyFollowing ? -1 : 1)) } : u;
    setSearchResults(rs => rs.map(flip));
    setFriendsList(rs => rs.map(flip));
    if (viewProfile?.id === target.id) setViewProfile(p => flip(p));
    setFriendCounts(c => ({ ...c,
      following: Math.max(0, c.following + (currentlyFollowing ? -1 : 1)),
      friends: target.follows_me ? Math.max(0, c.friends + (currentlyFollowing ? -1 : 1)) : c.friends }));
    try {
      await api(`/follows/${target.id}`, { method: currentlyFollowing ? "DELETE" : "POST" });
      // soft-refresh counts to stay accurate
      const c = await api("/follows/me/counts");
      setFriendCounts(c);
    } catch (e) {
      alert(e.message);
      // rollback on failure
      const undo = (u) => u.id === target.id ? { ...u, i_follow: currentlyFollowing,
        follower_count: Math.max(0, (u.follower_count ?? 0) + (currentlyFollowing ? 1 : -1)) } : u;
      setSearchResults(rs => rs.map(undo));
      setFriendsList(rs => rs.map(undo));
      if (viewProfile?.id === target.id) setViewProfile(p => undo(p));
    }
    setViewBusy(false);
  };

  const adminResolveReport = async (id, status) => {
    try {
      await api(`/admin/reports/${id}`, { method: "PATCH", body: { status } });
      const d = await api(`/admin/reports?status=${reportsFilter}`);
      setReports(d.reports || []); setReportsCounts(d.counts || { open: 0, resolved: 0 });
    } catch (e) { alert(e.message); }
  };

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
    Promise.all([api("/admin/stats"), api("/admin/withdrawals"), api("/admin/questions/stats")])
      .then(([stats, wds, qb]) => {
        setAdminStats(stats);
        setAdminWithdrawals(wds.requests || []);
        setQbStats(qb);
      })
      .catch(() => {})
      .finally(() => setAdminLoading(false));
  }, [page]);

  const reloadQbStats = async () => {
    try { const qb = await api("/admin/questions/stats"); setQbStats(qb); } catch {}
  };

  const downloadTemplate = () => {
    const token = localStorage.getItem("qr_token");
    fetch("/api/admin/questions/template", { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.blob())
      .then(blob => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = "QuizRupee_question_template.xlsx";
        document.body.appendChild(a); a.click(); a.remove();
        URL.revokeObjectURL(url);
      })
      .catch(() => setQbMsg({ type: "err", text: "Download failed." }));
  };

  const handleQbUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setQbUploading(true); setQbMsg(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("mode", qbMode);
      const token = localStorage.getItem("qr_token");
      const res = await fetch("/api/admin/questions/import", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Import failed");
      const errSuffix = (d.errors?.length ? ` · ${d.errors.length} skipped (errors)` : "");
      setQbMsg({
        type: "ok",
        text: `✅ Imported ${d.inserted} new questions${d.skipped_duplicates ? ` · ${d.skipped_duplicates} duplicates skipped` : ""}${d.cleared_in_replace_mode ? ` · ${d.cleared_in_replace_mode} cleared` : ""}${errSuffix}`,
        errors: d.errors || [],
      });
      await reloadQbStats();
    } catch (err) {
      setQbMsg({ type: "err", text: `❌ ${err.message}` });
    } finally {
      setQbUploading(false);
      if (qbFileRef.current) qbFileRef.current.value = "";
    }
  };

  const handleQbClear = async (cat) => {
    if (!confirm(`Delete ALL questions in "${cat}"? This cannot be undone.`)) return;
    try {
      const d = await api(`/admin/questions/${cat}`, { method: "DELETE" });
      setQbMsg({ type: "ok", text: `✅ Cleared ${d.deleted} questions from ${cat}` });
      await reloadQbStats();
    } catch (e) { setQbMsg({ type: "err", text: `❌ ${e.message}` }); }
  };

  /* ── AUTH ── */
  const handleAuth = async () => {
    setAuthErr(""); setAuthBusy(true);
    try {
      const endpoint = authMode === "signup" ? "/auth/register" : "/auth/login";
      const body = authMode === "signup"
        ? { name: form.name, email: form.email, password: form.password, gender: form.gender, country: form.country, ...(refCode ? { ref_code: refCode } : {}) }
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
    setSideOpen(false);
  };

  /* ── PROFILE ── */
  const saveProfile = async ({ gender, country, regenerate_avatar } = {}) => {
    setProfileMsg(""); setProfileBusy(true);
    try {
      await api("/profile/me", { method: "PATCH", body: { gender, country, regenerate_avatar } });
      await refreshUser();
      setProfileMsg("Saved!");
      setTimeout(() => setProfileMsg(""), 2500);
    } catch (e) {
      setProfileMsg(`Error: ${e.message}`);
    }
    setProfileBusy(false);
  };

  /* ── HELP ── */
  const submitHelp = async () => {
    if (!helpMsg.trim()) return setHelpStatus("Please describe the issue");
    setHelpBusy(true); setHelpStatus("");
    try {
      await api("/help/report", { method: "POST", body: { message: helpMsg.trim() } });
      setHelpMsg("");
      setHelpStatus("✅ Thanks — your report has been sent. We'll review it shortly.");
    } catch (e) {
      setHelpStatus(`❌ ${e.message}`);
    }
    setHelpBusy(false);
  };

  const watchAd = async () => {
    if (adWatching || adWatchesToday >= MAX_ADS) return;
    setAdWatching(true);
    let c = 5; setAdCountdown(c);
    await new Promise(r => {
      const iv = setInterval(() => { c--; setAdCountdown(c); if (c <= 0) { clearInterval(iv); r(); } }, 1000);
    });
    try {
      const d = await api('/quiz/watch-ad', { method: 'POST' });
      setUser(d.user);
      const nc = adWatchesToday + 1;
      setAdWatchesToday(nc);
      localStorage.setItem('qr_ads', JSON.stringify({ date: new Date().toDateString(), count: nc }));
    } catch {}
    setAdWatching(false);
  };

  /* ── QUIZ ── */
  const startQuiz = async (catId) => {
    setLoadErr(""); setLoadingQ(true); setResult(null); setPage("quiz");
    try {
      const questions = await generateQuestions(catId);
      setQuiz({ catId, questions, idx: 0, answers: [] });
    } catch (e) {
      setLoadErr(e.message || "Couldn't load questions. Please try again.");
      setPage("menu");
    }
    setLoadingQ(false);
  };

  const handleAnswer = async (correct) => {
    if (!quiz) return;
    const answers = [...quiz.answers, correct];
    if (answers.length === 10) {
      const score = answers.filter(Boolean).length;
      try {
        const d = await api("/quiz/complete", { method: "POST", body: { category: quiz.catId, score } });
        const oldPts = user?.points || 0;
        setUser(d.user);
        await refreshCatStats();
        if (d.streak_bonus > 0) setStreakBonusNotif(d.streak_bonus);
        const newPts = d.user?.points || 0;
        for (const m of [100, 250, 500, 750, 1000, 2000, 5000]) {
          if (oldPts < m && newPts >= m) { setMilestone(m); break; }
        }
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
          <span>⚡ Curated Questions</span><span>🎯 1 pt / correct</span><span>💸 Withdraw via UPI</span>
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
        {authMode === "signup" && (
          <>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 10, fontWeight: 800, color: "#3a3a5a", letterSpacing: 1.5, display: "block", marginBottom: 8, textTransform: "uppercase" }}>Gender</label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
                {[["male","👨 Male"],["female","👩 Female"],["other","🧑 Other"]].map(([id, lbl]) => (
                  <button key={id} type="button" onClick={() => setForm(f => ({ ...f, gender: id }))}
                    style={{ padding: "10px 6px", borderRadius: 11, border: `1.5px solid ${form.gender === id ? "#e94560" : "#1a2238"}`, background: form.gender === id ? "rgba(233,69,96,.14)" : "#07070e", color: form.gender === id ? "#e94560" : "#888", fontWeight: 800, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>
                    {lbl}
                  </button>
                ))}
              </div>
            </div>
            <Select label="Country" value={form.country} onChange={v => setForm(f => ({ ...f, country: v }))} options={COUNTRIES} placeholder="Select your country" />
          </>
        )}
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
Free to play · No repeats per category<br />1 pt per correct · 1000 pts = ₹100 · Withdraw via UPI
      </div>
    </div>
  );

  /* ══ MAIN APP SHELL ═══════════════════════════════════════════════════════ */
  const navItems = [
    ["dashboard", "🏠", "Home"],
    ["menu", "🎮", "Play"],
    ["friends", "👥", "Friends"],
    ["rewards", "💎", "Earn"],
    ["global", "🌍", "Top"],
    ...(user.is_admin ? [["admin", "⚙️", "Admin"]] : []),
  ];

  return (
    <div style={{ minHeight: "100vh", background: "#07070e", color: "#e0e0e0", fontFamily: "'Nunito', sans-serif", display: "flex", flexDirection: "column", maxWidth: 430, margin: "0 auto" }}>
      <style>{STYLES}</style>
      <BannerAd pos="top" />

      {/* ── GLOBAL HEADER ── */}
      <div style={{ padding: "10px 15px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #141428", background: "#09091a", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={() => setSideOpen(true)} aria-label="menu"
            style={{ background: "transparent", border: "1.5px solid #1a1a30", borderRadius: 10, padding: "7px 11px", cursor: "pointer", display: "flex", flexDirection: "column", gap: 3, fontFamily: "inherit" }}>
            <span style={{ width: 16, height: 2, background: "#e94560", borderRadius: 1 }} />
            <span style={{ width: 16, height: 2, background: "#e94560", borderRadius: 1 }} />
            <span style={{ width: 16, height: 2, background: "#e94560", borderRadius: 1 }} />
          </button>
          <div>
            <div style={{ fontFamily: "'Orbitron', sans-serif", fontSize: 15, fontWeight: 900, color: "#e94560" }}>QuizRupee</div>
            <div style={{ fontSize: 11, color: "#3a3a5a", marginTop: 1 }}>👤 {user.name?.split(" ")[0]} · <span style={{ color: "#e94560", fontWeight: 800 }}>{pts.toLocaleString()} pts</span></div>
          </div>
        </div>
        <Avatar seed={user.avatar_seed} gender={user.gender} size={38} ring="#e9456050" />
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

            {/* Urgency banner */}
            {pts >= 700 && pts < 1000 && (
              <div style={{ background: "linear-gradient(135deg,rgba(249,115,22,.15),rgba(239,68,68,.08))", border: "1.5px solid #f9731640", borderRadius: 14, padding: "13px 16px", marginBottom: 14, textAlign: "center" }}>
                <div style={{ fontWeight: 900, fontSize: 15, color: "#f97316", marginBottom: 3 }}>🔥 SO CLOSE TO ₹100!</div>
                <div style={{ fontSize: 12, color: "#555", marginBottom: 10 }}>Only <span style={{ color: "#f97316", fontWeight: 900 }}>{(1000 - pts).toLocaleString()} pts</span> away — keep playing!</div>
                <button onClick={() => setPage("menu")} style={{ padding: "9px 22px", borderRadius: 10, background: "linear-gradient(135deg,#f97316,#ef4444)", color: "#fff", fontWeight: 900, fontSize: 13, border: "none", cursor: "pointer", fontFamily: "inherit" }}>Play Now →</button>
              </div>
            )}

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
            <div style={{ fontSize: 12, color: "#444", marginBottom: 6 }}>Curated bank · You'll never see the same question twice</div>
            {loadErr && <div style={{ background: "rgba(239,68,68,.1)", border: "1px solid #ef444430", borderRadius: 12, padding: "11px 14px", marginBottom: 14, fontSize: 13, color: "#ef4444", fontWeight: 700 }}>⚠️ {loadErr}</div>}
            <div style={{ fontSize: 11, color: "#252540", marginBottom: 14, padding: "9px 13px", background: "#0c0c1e", borderRadius: 10, border: "1px solid #181828", lineHeight: 1.7 }}>
              💡 10 questions · 1 pt per correct answer · 10 pts = ₹1 · Don't switch tabs!
            </div>
            {CATEGORIES.map((cat, idx) => {
              const cs = catMap[cat.id];
              return (
                <div key={cat.id}>
                {idx === 4 && <BannerAd pos="mid" />}
                <div onClick={() => !loadingQ && startQuiz(cat.id)}
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
                </div>
              );
            })}
            {adWatchesToday < MAX_ADS && (
              <button onClick={watchAd} disabled={adWatching} style={{ width: "100%", padding: "12px", borderRadius: 13, background: "rgba(59,130,246,.09)", border: "1.5px solid #3b82f620", color: "#60a5fa", fontWeight: 800, fontSize: 13, cursor: "pointer", fontFamily: "inherit", marginTop: 4, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                📺 Watch Ad → +15 pts <span style={{ fontSize: 11, color: "#3b82f680" }}>({MAX_ADS - adWatchesToday} left today)</span>
              </button>
            )}
          </div>
        )}

        {/* ══ QUIZ LOADING ══ */}
        {page === "quiz" && loadingQ && (
          <div style={{ padding: "20px 15px" }}>
            <div style={{ background: "#0c0c1e", borderRadius: 16, padding: 18, marginBottom: 16, border: "1px solid #181828", textAlign: "center" }}>
              <div style={{ fontSize: 9, color: "#252540", fontWeight: 800, letterSpacing: 3, marginBottom: 12 }}>📢 ADVERTISEMENT</div>
              <div style={{ height: 110, background: "linear-gradient(135deg,#10102a,#07070e)", borderRadius: 12, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", border: "1px dashed #1a1a30", gap: 6 }}>
                <div style={{ fontSize: 30 }}>🎮</div>
                <div style={{ fontSize: 10, color: "#1e1e38", fontWeight: 800 }}>AD SPACE · 320×110</div>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "16px 0" }}>
              <div style={{ width: 44, height: 44, border: "4px solid #181828", borderTopColor: "#e94560", borderRadius: "50%", animation: "spin 1s linear infinite", marginBottom: 16 }} />
              <div style={{ fontFamily: "'Orbitron', sans-serif", fontSize: 13, color: "#e94560", fontWeight: 900 }}>Loading Questions...</div>
              <div style={{ fontSize: 12, color: "#444", marginTop: 6 }}>Fresh questions just for you ✨</div>
            </div>
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
                {q.options.map((opt, i) => <AnswerBtn key={`${quiz.idx}-${i}`} text={opt.text} isCorrect={opt.isCorrect} onAnswer={handleAnswer} onLock={() => setQLocked(true)} locked={qLocked} />)}
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
            {adWatchesToday < MAX_ADS && (
              <button onClick={watchAd} disabled={adWatching} style={{ width: "100%", padding: "12px", borderRadius: 13, background: "linear-gradient(135deg,rgba(59,130,246,.18),rgba(59,130,246,.08))", border: "1.5px solid #3b82f650", color: "#60a5fa", fontWeight: 900, fontSize: 14, cursor: "pointer", fontFamily: "inherit", marginBottom: 11, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                📺 Watch Ad → +15 pts &nbsp;<span style={{ fontSize: 11, color: "#3b82f6", fontWeight: 700 }}>({MAX_ADS - adWatchesToday} left today)</span>
              </button>
            )}
            <div style={{ background: pts >= 800 && pts < 1000 ? "rgba(249,115,22,.1)" : "#0c0c1e", border: `1px solid ${pts >= 800 && pts < 1000 ? "#f9731640" : "#181828"}`, borderRadius: 14, padding: "11px 16px", marginBottom: 14, fontSize: 12, color: pts >= 800 && pts < 1000 ? "#f97316" : "#444", fontWeight: pts >= 800 && pts < 1000 ? 800 : 400 }}>
              {pts >= 1000 ? "🎉 You can withdraw now! Go to Rewards tab." : pts >= 800 ? `🔥 SO CLOSE! Only ${(1000 - pts).toLocaleString()} more pts for ₹100 withdrawal!` : `🎯 ${(1000 - pts).toLocaleString()} more points to unlock ₹100 withdrawal`}
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

            {/* Watch Ad Card */}
            <div style={{ background: "linear-gradient(135deg,rgba(59,130,246,.12),rgba(59,130,246,.04))", border: "1.5px solid #3b82f628", borderRadius: 16, padding: 18, marginBottom: 14, textAlign: "center" }}>
              <div style={{ fontSize: 26, marginBottom: 6 }}>📺</div>
              <div style={{ fontWeight: 900, fontSize: 15, color: "#60a5fa", marginBottom: 3 }}>Watch Ad → +15 pts</div>
              <div style={{ fontSize: 11, color: "#444", marginBottom: 12 }}>{adWatchesToday >= MAX_ADS ? "Come back tomorrow for more!" : `${MAX_ADS - adWatchesToday} of ${MAX_ADS} free watches left today`}</div>
              <div style={{ background: "#0c0c1e", borderRadius: 6, height: 5, marginBottom: 12, overflow: "hidden" }}>
                <div style={{ height: "100%", background: "linear-gradient(90deg,#3b82f6,#60a5fa)", width: `${((MAX_ADS - adWatchesToday) / MAX_ADS) * 100}%`, transition: "width .4s" }} />
              </div>
              <button onClick={watchAd} disabled={adWatching || adWatchesToday >= MAX_ADS}
                style={{ width: "100%", padding: "12px", borderRadius: 11, background: adWatchesToday >= MAX_ADS ? "#181828" : "linear-gradient(135deg,#3b82f6,#1d4ed8)", color: adWatchesToday >= MAX_ADS ? "#444" : "#fff", fontWeight: 900, fontSize: 14, border: "none", cursor: adWatchesToday >= MAX_ADS ? "not-allowed" : "pointer", fontFamily: "inherit" }}>
                {adWatchesToday >= MAX_ADS ? "✅ All done for today" : "📺 Watch Ad Now"}
              </button>
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

        {/* ══ FRIENDS ══ */}
        {page === "friends" && (
          <div style={{ padding: "18px 15px 12px", animation: "fadeUp .35s ease" }}>
            <div style={{ fontFamily: "'Orbitron', sans-serif", fontSize: 17, fontWeight: 900, color: "#a855f7", marginBottom: 4 }}>👥 Friends</div>
            <div style={{ fontSize: 12, color: "#444", marginBottom: 14 }}>Follow other quizzers. Mutual follows = friends.</div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginBottom: 12 }}>
              <button onClick={() => setFriendsTab("friends")}
                style={{ padding: "10px 4px", borderRadius: 11, border: `1.5px solid ${friendsTab === "friends" ? "#a855f7" : "#1a2238"}`, background: friendsTab === "friends" ? "rgba(168,85,247,.14)" : "#07070e", color: friendsTab === "friends" ? "#a855f7" : "#888", fontWeight: 800, fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>
                Friends · {friendCounts.friends}
              </button>
              <button onClick={() => setFriendsTab("following")}
                style={{ padding: "10px 4px", borderRadius: 11, border: `1.5px solid ${friendsTab === "following" ? "#3b82f6" : "#1a2238"}`, background: friendsTab === "following" ? "rgba(59,130,246,.14)" : "#07070e", color: friendsTab === "following" ? "#60a5fa" : "#888", fontWeight: 800, fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>
                Following · {friendCounts.following}
              </button>
              <button onClick={() => setFriendsTab("followers")}
                style={{ padding: "10px 4px", borderRadius: 11, border: `1.5px solid ${friendsTab === "followers" ? "#f59e0b" : "#1a2238"}`, background: friendsTab === "followers" ? "rgba(245,158,11,.14)" : "#07070e", color: friendsTab === "followers" ? "#f59e0b" : "#888", fontWeight: 800, fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>
                Followers · {friendCounts.followers}
              </button>
            </div>

            <button onClick={() => setFriendsTab("find")}
              style={{ width: "100%", padding: 11, borderRadius: 12, border: "none", background: friendsTab === "find" ? "linear-gradient(135deg,#22c55e,#16a34a)" : "rgba(34,197,94,.12)", color: friendsTab === "find" ? "#000" : "#22c55e", fontWeight: 900, fontSize: 13, cursor: "pointer", fontFamily: "inherit", marginBottom: 12 }}>
              🔍 Find People
            </button>

            {friendsTab === "find" ? (
              <>
                <input value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder="Search by name or email..."
                  style={{ width: "100%", padding: "12px 16px", background: "#07070e", border: "1.5px solid #1a2238", borderRadius: 12, color: "#e0e0e0", fontSize: 14, fontFamily: "inherit", outline: "none", boxSizing: "border-box", marginBottom: 12 }} />
                {searchQ.trim().length < 2 && <div style={{ color: "#444", fontSize: 12, textAlign: "center", padding: "30px 0" }}>Type at least 2 characters to search.</div>}
                {searchQ.trim().length >= 2 && searchBusy && <div style={{ color: "#666", fontSize: 12, textAlign: "center", padding: "16px 0" }}>Searching...</div>}
                {searchQ.trim().length >= 2 && !searchBusy && searchResults.length === 0 && (
                  <div style={{ color: "#444", fontSize: 12, textAlign: "center", padding: "30px 0" }}>No users found for "{searchQ}".</div>
                )}
                {searchResults.map(u => (
                  <div key={u.id} onClick={() => openUserProfile(u.id)} className="card" style={{ marginBottom: 8, padding: 12, display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }}>
                    <Avatar seed={u.avatar_seed} gender={u.gender} size={46} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 900, fontSize: 14, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.name}</div>
                      <div style={{ fontSize: 10, color: "#666", marginTop: 2 }}>
                        {u.country && <>📍 {u.country} · </>}{u.follower_count} followers
                        {u.follows_me && <span style={{ color: "#a855f7", marginLeft: 6, fontWeight: 800 }}>· follows you</span>}
                      </div>
                    </div>
                    <button onClick={e => { e.stopPropagation(); toggleFollow(u, u.i_follow); }}
                      style={{ padding: "8px 14px", borderRadius: 10, border: "none", background: u.i_follow ? "#1a1a30" : "linear-gradient(135deg,#a855f7,#7c3aed)", color: u.i_follow ? "#888" : "#fff", fontWeight: 900, fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>
                      {u.i_follow ? "Following" : "+ Follow"}
                    </button>
                  </div>
                ))}
              </>
            ) : (
              <>
                {friendsLoading && <div style={{ color: "#666", fontSize: 12, textAlign: "center", padding: "30px 0" }}>Loading...</div>}
                {!friendsLoading && friendsList.length === 0 && (
                  <div style={{ color: "#444", fontSize: 13, textAlign: "center", padding: "30px 0", lineHeight: 1.6 }}>
                    {friendsTab === "friends" && <>No friends yet. <br/>Mutual follows show up here.</>}
                    {friendsTab === "following" && <>You're not following anyone yet. <br/>Tap "Find People" to discover.</>}
                    {friendsTab === "followers" && <>No followers yet. Share QuizRupee with friends!</>}
                  </div>
                )}
                {friendsList.map(u => (
                  <div key={u.id} onClick={() => openUserProfile(u.id)} className="card" style={{ marginBottom: 8, padding: 12, display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }}>
                    <Avatar seed={u.avatar_seed} gender={u.gender} size={46} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 900, fontSize: 14, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.name}</div>
                      <div style={{ fontSize: 10, color: "#666", marginTop: 2 }}>
                        {u.country && <>📍 {u.country} · </>}{u.follower_count} followers
                        {friendsTab !== "friends" && u.i_follow && u.follows_me && <span style={{ color: "#a855f7", marginLeft: 6, fontWeight: 800 }}>· friends</span>}
                        {friendsTab === "followers" && !u.i_follow && <span style={{ color: "#f59e0b", marginLeft: 6, fontWeight: 800 }}>· follow back</span>}
                      </div>
                    </div>
                    {friendsTab === "followers" && !u.i_follow ? (
                      <button onClick={e => { e.stopPropagation(); toggleFollow(u, false); }}
                        style={{ padding: "8px 14px", borderRadius: 10, border: "none", background: "linear-gradient(135deg,#a855f7,#7c3aed)", color: "#fff", fontWeight: 900, fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>
                        + Follow
                      </button>
                    ) : (
                      <button onClick={e => { e.stopPropagation(); toggleFollow(u, u.i_follow); }}
                        style={{ padding: "8px 12px", borderRadius: 10, border: "1.5px solid #1a2238", background: "transparent", color: u.i_follow ? "#888" : "#a855f7", fontWeight: 800, fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>
                        {u.i_follow ? "Following" : "+ Follow"}
                      </button>
                    )}
                  </div>
                ))}
              </>
            )}
          </div>
        )}

        {/* ══ PROFILE ══ */}
        {page === "profile" && (
          <div style={{ padding: "18px 15px", animation: "fadeUp .35s ease" }}>
            <div style={{ fontFamily: "'Orbitron', sans-serif", fontSize: 17, fontWeight: 900, color: "#e94560", marginBottom: 18 }}>👤 My Profile</div>

            <div className="card" style={{ marginBottom: 14, display: "flex", alignItems: "center", gap: 14 }}>
              <Avatar seed={user.avatar_seed} gender={user.gender} size={84} ring="#e94560" />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 900, fontSize: 17, color: "#fff" }}>{user.name}</div>
                <div style={{ fontSize: 11, color: "#666", marginTop: 2, wordBreak: "break-all" }}>{user.email}</div>
                <div style={{ marginTop: 6, display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {user.gender && <span className="tag" style={{ background: "rgba(233,69,96,.12)", color: "#e94560", border: "1px solid #e9456033" }}>{user.gender === "male" ? "♂ Male" : user.gender === "female" ? "♀ Female" : "🧑 Other"}</span>}
                  {user.country && <span className="tag" style={{ background: "rgba(59,130,246,.1)", color: "#60a5fa", border: "1px solid #3b82f633" }}>📍 {user.country}</span>}
                  {user.is_admin && <span className="tag" style={{ background: "rgba(168,85,247,.12)", color: "#a855f7", border: "1px solid #a855f733" }}>ADMIN</span>}
                </div>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 10 }}>
              <div className="card" style={{ textAlign: "center", padding: 10 }}>
                <div style={{ fontSize: 16, fontWeight: 900, color: "#e94560" }}>{pts.toLocaleString()}</div>
                <div style={{ fontSize: 9, color: "#252540", fontWeight: 800, letterSpacing: 1 }}>POINTS</div>
              </div>
              <div className="card" style={{ textAlign: "center", padding: 10 }}>
                <div style={{ fontSize: 16, fontWeight: 900, color: "#22c55e" }}>₹{parseFloat(user.total_earned || 0).toFixed(0)}</div>
                <div style={{ fontSize: 9, color: "#252540", fontWeight: 800, letterSpacing: 1 }}>EARNED</div>
              </div>
              <div className="card" style={{ textAlign: "center", padding: 10 }}>
                <div style={{ fontSize: 16, fontWeight: 900, color: "#f59e0b" }}>{user.streak || 0}🔥</div>
                <div style={{ fontSize: 9, color: "#252540", fontWeight: 800, letterSpacing: 1 }}>STREAK</div>
              </div>
            </div>

            <div onClick={() => setPage("friends")} className="card" style={{ marginBottom: 14, padding: 10, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 0, cursor: "pointer", border: "1px solid #a855f733" }}>
              <div style={{ textAlign: "center", borderRight: "1px solid #181828" }}>
                <div style={{ fontSize: 15, fontWeight: 900, color: "#a855f7" }}>{friendCounts.friends}</div>
                <div style={{ fontSize: 9, color: "#252540", fontWeight: 800, letterSpacing: 1 }}>FRIENDS</div>
              </div>
              <div style={{ textAlign: "center", borderRight: "1px solid #181828" }}>
                <div style={{ fontSize: 15, fontWeight: 900, color: "#60a5fa" }}>{friendCounts.following}</div>
                <div style={{ fontSize: 9, color: "#252540", fontWeight: 800, letterSpacing: 1 }}>FOLLOWING</div>
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 15, fontWeight: 900, color: "#f59e0b" }}>{friendCounts.followers}</div>
                <div style={{ fontSize: 9, color: "#252540", fontWeight: 800, letterSpacing: 1 }}>FOLLOWERS</div>
              </div>
            </div>

            <div className="card" style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: "#252540", letterSpacing: 2, marginBottom: 12 }}>EDIT PROFILE</div>
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 10, fontWeight: 800, color: "#3a3a5a", letterSpacing: 1.5, display: "block", marginBottom: 8, textTransform: "uppercase" }}>Gender</label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
                  {[["male","👨 Male"],["female","♀ Female"],["other","🧑 Other"]].map(([id, lbl]) => (
                    <button key={id} type="button" onClick={() => setProfileEdit(p => ({ ...p, gender: id }))}
                      style={{ padding: "10px 6px", borderRadius: 11, border: `1.5px solid ${profileEdit.gender === id ? "#e94560" : "#1a2238"}`, background: profileEdit.gender === id ? "rgba(233,69,96,.14)" : "#07070e", color: profileEdit.gender === id ? "#e94560" : "#888", fontWeight: 800, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>
                      {lbl}
                    </button>
                  ))}
                </div>
              </div>
              <Select label="Country" value={profileEdit.country} onChange={v => setProfileEdit(p => ({ ...p, country: v }))} options={COUNTRIES} placeholder="Select your country" />
              {!user.gender && !user.country && (
                <div style={{ marginBottom: 10, padding: "8px 12px", borderRadius: 8, background: "rgba(245,158,11,.1)", border: "1px solid #f59e0b33", color: "#f59e0b", fontSize: 11, fontWeight: 700 }}>
                  ℹ️ Please select both gender and country to create your profile.
                </div>
              )}
              <button onClick={() => saveProfile({ gender: profileEdit.gender, country: profileEdit.country })}
                disabled={profileBusy || (!user.gender && (!profileEdit.gender || !profileEdit.country)) || (!profileEdit.gender && !profileEdit.country)}
                style={{ width: "100%", padding: 12, borderRadius: 12, border: "none", background: profileBusy ? "#1a1a30" : "linear-gradient(135deg,#e94560,#b91c4a)", color: profileBusy ? "#444" : "#fff", fontWeight: 900, fontSize: 14, fontFamily: "inherit", cursor: profileBusy ? "not-allowed" : "pointer" }}>
                {profileBusy ? "Saving..." : "Save Changes"}
              </button>
              <button onClick={() => saveProfile({ regenerate_avatar: true })} disabled={profileBusy || !user.gender}
                style={{ width: "100%", padding: 10, borderRadius: 11, marginTop: 8, background: "transparent", border: "1.5px solid #1a2238", color: "#888", fontWeight: 800, fontSize: 12, cursor: profileBusy ? "not-allowed" : "pointer", fontFamily: "inherit" }}>
                🎲 Shuffle My Avatar
              </button>
              {profileMsg && <div style={{ marginTop: 10, padding: "8px 12px", borderRadius: 8, background: profileMsg.startsWith("Error") ? "rgba(239,68,68,.1)" : "rgba(34,197,94,.1)", color: profileMsg.startsWith("Error") ? "#ef4444" : "#22c55e", fontSize: 12, fontWeight: 700 }}>{profileMsg}</div>}
            </div>
          </div>
        )}

        {/* ══ HELP / REPORT ══ */}
        {page === "help" && (
          <div style={{ padding: "18px 15px", animation: "fadeUp .35s ease" }}>
            <div style={{ fontFamily: "'Orbitron', sans-serif", fontSize: 17, fontWeight: 900, color: "#3b82f6", marginBottom: 4 }}>🆘 Help & Report</div>
            <div style={{ fontSize: 12, color: "#444", marginBottom: 18 }}>Found a bug, withdrawal issue, or anything off? Tell us — admin will review.</div>

            <div className="card" style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: "#252540", letterSpacing: 2, marginBottom: 10 }}>DESCRIBE THE ISSUE</div>
              <textarea value={helpMsg} onChange={e => setHelpMsg(e.target.value)} maxLength={2000}
                placeholder="Example: My withdrawal was approved 3 days ago but I haven't received the money on UPI. Or: A question in the Sports category was wrong..."
                style={{ width: "100%", minHeight: 140, padding: 12, background: "#07070e", border: "1.5px solid #181828", borderRadius: 12, color: "#e0e0e0", fontSize: 14, fontFamily: "inherit", outline: "none", resize: "vertical", boxSizing: "border-box", lineHeight: 1.5 }} />
              <div style={{ fontSize: 10, color: "#444", marginTop: 4, textAlign: "right" }}>{helpMsg.length}/2000</div>
              <button onClick={submitHelp} disabled={helpBusy || !helpMsg.trim()}
                style={{ width: "100%", padding: 12, borderRadius: 12, border: "none", marginTop: 8, background: helpBusy || !helpMsg.trim() ? "#1a1a30" : "linear-gradient(135deg,#3b82f6,#1d4ed8)", color: helpBusy || !helpMsg.trim() ? "#444" : "#fff", fontWeight: 900, fontSize: 14, fontFamily: "inherit", cursor: helpBusy || !helpMsg.trim() ? "not-allowed" : "pointer" }}>
                {helpBusy ? "Sending..." : "Send Report"}
              </button>
              {helpStatus && <div style={{ marginTop: 10, padding: "10px 12px", borderRadius: 8, background: helpStatus.startsWith("✅") ? "rgba(34,197,94,.1)" : "rgba(239,68,68,.1)", color: helpStatus.startsWith("✅") ? "#22c55e" : "#ef4444", fontSize: 12, fontWeight: 700, lineHeight: 1.5 }}>{helpStatus}</div>}
            </div>

            <div style={{ fontSize: 11, color: "#444", lineHeight: 1.7, padding: "0 4px" }}>
              💡 Tip: Include details like the time, category, exact button you tapped, and what you expected to happen. Screenshots aren't supported but a clear description goes a long way.
            </div>
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

            {/* QUESTION BANK MANAGEMENT */}
            <div style={{ fontSize: 10, fontWeight: 800, color: "#252540", letterSpacing: 2, marginBottom: 12 }}>📚 QUESTION BANK</div>

            <div className="card" style={{ marginBottom: 18, padding: 14 }}>
              {qbStats && (
                <>
                  <div style={{ fontSize: 12, color: "#444", marginBottom: 4 }}>Total questions in bank</div>
                  <div style={{ fontFamily: "'Orbitron', sans-serif", fontSize: 26, fontWeight: 900, color: qbStats.total >= 200 ? "#22c55e" : qbStats.total >= 50 ? "#f59e0b" : "#ef4444", marginBottom: 10 }}>
                    {qbStats.total.toLocaleString()}
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginBottom: 12 }}>
                    {Object.entries(qbStats.stats).map(([cat, n]) => {
                      const c = CATEGORIES.find(x => x.id === cat);
                      const color = n >= 200 ? "#22c55e" : n >= 50 ? "#f59e0b" : n > 0 ? "#a855f7" : "#666";
                      return (
                        <div key={cat} style={{ background: "rgba(0,0,0,.25)", border: `1px solid ${color}33`, borderRadius: 8, padding: "6px 8px", textAlign: "center" }}>
                          <div style={{ fontSize: 14 }}>{c?.icon}</div>
                          <div style={{ fontSize: 9, color: "#666", fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.5 }}>{c?.label || cat}</div>
                          <div style={{ fontSize: 14, fontWeight: 900, color, marginTop: 2 }}>{n}</div>
                          {n > 0 && (
                            <button onClick={() => handleQbClear(cat)} style={{ marginTop: 4, fontSize: 9, padding: "2px 6px", borderRadius: 5, background: "rgba(239,68,68,.1)", border: "1px solid #ef444433", color: "#ef4444", cursor: "pointer", fontFamily: "inherit", fontWeight: 700 }}>clear</button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <div style={{ fontSize: 10, color: "#666", marginBottom: 12, lineHeight: 1.5 }}>
                    Recommended: 200+ per category. Below 50 shows orange. Below 10 = users will see error.
                  </div>
                </>
              )}

              <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                <button onClick={downloadTemplate} style={{ flex: 1, padding: "10px", borderRadius: 9, background: "rgba(59,130,246,.15)", border: "1.5px solid #3b82f6", color: "#60a5fa", fontWeight: 800, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>
                  ⬇️ Download Template
                </button>
              </div>

              <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
                <button onClick={() => setQbMode("add")} style={{ flex: 1, padding: "8px", borderRadius: 8, background: qbMode === "add" ? "rgba(34,197,94,.18)" : "rgba(0,0,0,.25)", border: `1.5px solid ${qbMode === "add" ? "#22c55e" : "#333"}`, color: qbMode === "add" ? "#22c55e" : "#666", fontWeight: 800, fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>
                  ➕ ADD MODE
                </button>
                <button onClick={() => setQbMode("replace")} style={{ flex: 1, padding: "8px", borderRadius: 8, background: qbMode === "replace" ? "rgba(239,68,68,.18)" : "rgba(0,0,0,.25)", border: `1.5px solid ${qbMode === "replace" ? "#ef4444" : "#333"}`, color: qbMode === "replace" ? "#ef4444" : "#666", fontWeight: 800, fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>
                  🔄 REPLACE MODE
                </button>
              </div>
              <div style={{ fontSize: 10, color: "#555", marginBottom: 10, lineHeight: 1.5 }}>
                {qbMode === "add"
                  ? "Add: appends new questions; duplicates (same text) are skipped automatically."
                  : "Replace: deletes ALL existing questions in the categories present in the file before importing. Use for weekly refreshes."}
              </div>

              <input ref={qbFileRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleQbUpload} disabled={qbUploading} style={{ display: "none" }} />
              <button onClick={() => qbFileRef.current?.click()} disabled={qbUploading} style={{ width: "100%", padding: "12px", borderRadius: 10, background: "linear-gradient(135deg,#a855f7,#7c3aed)", border: "none", color: "#fff", fontWeight: 900, fontSize: 13, cursor: qbUploading ? "wait" : "pointer", fontFamily: "inherit", opacity: qbUploading ? 0.6 : 1 }}>
                {qbUploading ? "⏳ Uploading & parsing..." : "📤 Upload Excel File"}
              </button>

              {qbMsg && (
                <div style={{ marginTop: 10, padding: "10px 12px", borderRadius: 8, background: qbMsg.type === "ok" ? "rgba(34,197,94,.1)" : "rgba(239,68,68,.1)", border: `1px solid ${qbMsg.type === "ok" ? "#22c55e44" : "#ef444444"}`, color: qbMsg.type === "ok" ? "#86efac" : "#fca5a5", fontSize: 12, lineHeight: 1.5 }}>
                  {qbMsg.text}
                  {qbMsg.errors?.length > 0 && (
                    <details style={{ marginTop: 6 }}>
                      <summary style={{ cursor: "pointer", fontSize: 10, color: "#999" }}>Show {qbMsg.errors.length} row errors</summary>
                      <div style={{ marginTop: 6, fontSize: 10, color: "#999", maxHeight: 120, overflow: "auto" }}>
                        {qbMsg.errors.map((e, i) => <div key={i}>• {e}</div>)}
                      </div>
                    </details>
                  )}
                </div>
              )}
            </div>

            <div style={{ fontSize: 10, fontWeight: 800, color: "#252540", letterSpacing: 2, marginBottom: 12, marginTop: 4 }}>USER REPORTS / HELP</div>

            <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
              {[["open", `Open (${reportsCounts.open || 0})`], ["resolved", `Resolved (${reportsCounts.resolved || 0})`], ["all", "All"]].map(([id, lbl]) => (
                <button key={id} onClick={() => setReportsFilter(id)}
                  style={{ flex: 1, padding: "8px 4px", borderRadius: 9, border: `1.5px solid ${reportsFilter === id ? "#3b82f6" : "#1a2238"}`, background: reportsFilter === id ? "rgba(59,130,246,.14)" : "#07070e", color: reportsFilter === id ? "#60a5fa" : "#666", fontWeight: 800, fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>
                  {lbl}
                </button>
              ))}
            </div>

            {reports.length === 0 && (
              <div className="card" style={{ textAlign: "center", color: "#444", padding: "20px 0", marginBottom: 18 }}>No reports.</div>
            )}

            {reports.map(r => (
              <div key={r.id} className="card" style={{ marginBottom: 10, border: `1px solid ${r.status === "open" ? "#3b82f633" : "#181828"}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8, gap: 8 }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontWeight: 900, fontSize: 13, color: "#fff" }}>{r.user_name || "(deleted user)"}</div>
                    <div style={{ fontSize: 10, color: "#666", wordBreak: "break-all" }}>{r.user_email || "—"}</div>
                  </div>
                  <span className="tag" style={{ background: r.status === "open" ? "rgba(59,130,246,.14)" : "rgba(34,197,94,.14)", color: r.status === "open" ? "#60a5fa" : "#22c55e", border: `1px solid ${r.status === "open" ? "#3b82f633" : "#22c55e33"}`, fontSize: 9 }}>
                    {r.status.toUpperCase()}
                  </span>
                </div>
                <div style={{ fontSize: 13, color: "#ccc", lineHeight: 1.55, padding: "10px 12px", background: "#07070e", borderRadius: 8, whiteSpace: "pre-wrap", wordBreak: "break-word", marginBottom: 8 }}>{r.message}</div>
                <div style={{ fontSize: 10, color: "#444", marginBottom: 8 }}>
                  {new Date(r.created_at).toLocaleString("en-IN")}
                  {r.resolved_at && <span> · Resolved {new Date(r.resolved_at).toLocaleString("en-IN")}</span>}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                  {r.status === "open" ? (
                    <button onClick={() => adminResolveReport(r.id, "resolved")} style={{ gridColumn: "1 / span 2", padding: 8, borderRadius: 9, background: "rgba(34,197,94,.15)", border: "1.5px solid #22c55e", color: "#22c55e", fontWeight: 900, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>✅ Mark Resolved</button>
                  ) : (
                    <button onClick={() => adminResolveReport(r.id, "open")} style={{ gridColumn: "1 / span 2", padding: 8, borderRadius: 9, background: "transparent", border: "1.5px solid #1a2238", color: "#666", fontWeight: 800, fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>↩ Reopen</button>
                  )}
                </div>
              </div>
            ))}

            <div style={{ fontSize: 10, fontWeight: 800, color: "#252540", letterSpacing: 2, margin: "18px 0 12px" }}>WITHDRAWAL REQUESTS</div>

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

      {/* ── AD WATCHING COUNTDOWN ── */}
      {adWatching && (
        <div className="overlay">
          <div className="modal" style={{ textAlign: "center" }}>
            <div style={{ fontSize: 44, marginBottom: 12 }}>📺</div>
            <div style={{ fontFamily: "'Orbitron', sans-serif", fontSize: 14, fontWeight: 900, color: "#60a5fa", marginBottom: 6 }}>Watching Ad...</div>
            <div style={{ width: 72, height: 72, borderRadius: "50%", background: "rgba(59,130,246,.12)", border: "3px solid #3b82f6", display: "flex", alignItems: "center", justifyContent: "center", margin: "16px auto" }}>
              <span style={{ fontFamily: "'Orbitron', sans-serif", fontSize: 28, fontWeight: 900, color: "#60a5fa" }}>{adCountdown}</span>
            </div>
            <p style={{ fontSize: 13, color: "#444", lineHeight: 1.6 }}>Stay with us to earn <span style={{ color: "#60a5fa", fontWeight: 900 }}>+15 pts</span></p>
          </div>
        </div>
      )}

      {/* ── MILESTONE CELEBRATION ── */}
      {milestone && (
        <div className="overlay" onClick={() => setMilestone(null)}>
          <div className="modal" style={{ textAlign: "center" }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 58, marginBottom: 10 }}>🎉</div>
            <div style={{ fontFamily: "'Orbitron', sans-serif", fontSize: 13, fontWeight: 900, color: "#f59e0b", letterSpacing: 2, marginBottom: 6 }}>MILESTONE!</div>
            <div style={{ fontFamily: "'Orbitron', sans-serif", fontSize: 34, fontWeight: 900, color: "#e94560", marginBottom: 6 }}>{milestone.toLocaleString()} pts</div>
            <p style={{ fontSize: 13, color: "#555", lineHeight: 1.65, marginBottom: 20 }}>
              {milestone >= 1000 ? "🏆 You can now withdraw ₹100! Go to Rewards tab." : `Amazing! You're on your way to ₹${Math.floor(milestone / 100)}. Keep going!`}
            </p>
            <button onClick={() => { setMilestone(null); if (milestone >= 1000) setPage("rewards"); }} style={{ width: "100%", padding: 14, borderRadius: 13, background: "linear-gradient(135deg,#f59e0b,#e67e22)", color: "#000", fontWeight: 900, fontSize: 15, border: "none", cursor: "pointer", fontFamily: "inherit" }}>
              {milestone >= 1000 ? "Withdraw Now 💰" : "Keep Earning! 🚀"}
            </button>
          </div>
        </div>
      )}

      {/* ── USER PROFILE MODAL ── */}
      {viewProfile && (
        <div className="overlay" onClick={() => setViewProfile(null)}>
          <div className="modal" style={{ textAlign: "left", maxWidth: 380 }} onClick={e => e.stopPropagation()}>
            {viewProfile.loading ? (
              <div style={{ padding: 30, textAlign: "center", color: "#666" }}>Loading...</div>
            ) : viewProfile.error ? (
              <div style={{ padding: 20, textAlign: "center", color: "#ef4444" }}>{viewProfile.error}</div>
            ) : (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14 }}>
                  <Avatar seed={viewProfile.avatar_seed} gender={viewProfile.gender} size={76} ring="#a855f7" />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 900, fontSize: 18, color: "#fff" }}>{viewProfile.name}</div>
                    <div style={{ marginTop: 4, display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {viewProfile.country && <span className="tag" style={{ background: "rgba(59,130,246,.1)", color: "#60a5fa", border: "1px solid #3b82f633" }}>📍 {viewProfile.country}</span>}
                      {viewProfile.gender && <span className="tag" style={{ background: "rgba(233,69,96,.12)", color: "#e94560", border: "1px solid #e9456033" }}>{viewProfile.gender === "male" ? "♂" : viewProfile.gender === "female" ? "♀" : "🧑"}</span>}
                    </div>
                    {viewProfile.follows_me && !viewProfile.is_me && (
                      <div style={{ fontSize: 10, color: "#a855f7", fontWeight: 800, marginTop: 4 }}>✦ Follows you</div>
                    )}
                  </div>
                  <button onClick={() => setViewProfile(null)} style={{ background: "none", border: "none", color: "#666", fontSize: 22, cursor: "pointer", padding: 0, alignSelf: "flex-start" }}>✕</button>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginBottom: 14 }}>
                  <div className="card" style={{ textAlign: "center", padding: 8 }}>
                    <div style={{ fontSize: 14, fontWeight: 900, color: "#a855f7" }}>{viewProfile.follower_count ?? 0}</div>
                    <div style={{ fontSize: 9, color: "#252540", fontWeight: 800 }}>FOLLOWERS</div>
                  </div>
                  <div className="card" style={{ textAlign: "center", padding: 8 }}>
                    <div style={{ fontSize: 14, fontWeight: 900, color: "#60a5fa" }}>{viewProfile.following_count ?? 0}</div>
                    <div style={{ fontSize: 9, color: "#252540", fontWeight: 800 }}>FOLLOWING</div>
                  </div>
                  <div className="card" style={{ textAlign: "center", padding: 8 }}>
                    <div style={{ fontSize: 14, fontWeight: 900, color: "#f59e0b" }}>{viewProfile.streak || 0}🔥</div>
                    <div style={{ fontSize: 9, color: "#252540", fontWeight: 800 }}>STREAK</div>
                  </div>
                </div>

                {viewProfile.is_me ? (
                  <button onClick={() => { setViewProfile(null); setPage("profile"); }}
                    style={{ width: "100%", padding: 12, borderRadius: 12, border: "1.5px solid #1a2238", background: "transparent", color: "#888", fontWeight: 800, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
                    This is you · Open Profile
                  </button>
                ) : (
                  <button onClick={() => toggleFollow(viewProfile, viewProfile.i_follow)} disabled={viewBusy}
                    style={{ width: "100%", padding: 13, borderRadius: 12, border: "none", background: viewBusy ? "#1a1a30" : (viewProfile.i_follow ? "#1a1a30" : "linear-gradient(135deg,#a855f7,#7c3aed)"), color: viewProfile.i_follow ? "#aaa" : "#fff", fontWeight: 900, fontSize: 14, cursor: viewBusy ? "not-allowed" : "pointer", fontFamily: "inherit" }}>
                    {viewBusy ? "..." : viewProfile.i_follow ? "✓ Following — tap to unfollow" : "+ Follow"}
                  </button>
                )}
                {viewProfile.i_follow && viewProfile.follows_me && !viewProfile.is_me && (
                  <div style={{ marginTop: 8, padding: "8px 10px", borderRadius: 8, background: "rgba(168,85,247,.1)", border: "1px solid #a855f733", color: "#a855f7", fontSize: 11, fontWeight: 700, textAlign: "center" }}>
                    ✦ You two are friends
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* ── SIDE MENU ── */}
      {sideOpen && (
        <div onClick={() => setSideOpen(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.7)", zIndex: 250, animation: "fadeUp .15s ease" }}>
          <div onClick={e => e.stopPropagation()}
            style={{ width: 280, maxWidth: "82vw", height: "100%", background: "#0c0c1e", borderRight: "1px solid #1a1a30", padding: "22px 18px", display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18, paddingBottom: 16, borderBottom: "1px solid #181828" }}>
              <Avatar seed={user.avatar_seed} gender={user.gender} size={52} ring="#e94560" />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 900, fontSize: 14, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.name}</div>
                <div style={{ fontSize: 11, color: "#e94560", fontWeight: 800, marginTop: 2 }}>{pts.toLocaleString()} pts · ₹{ptsRupees.toFixed(2)}</div>
              </div>
              <button onClick={() => setSideOpen(false)} style={{ background: "none", border: "none", color: "#666", fontSize: 22, cursor: "pointer", padding: 0 }}>✕</button>
            </div>

            {[
              ["profile", "👤", "Profile"],
              ["friends", "👥", "Friends"],
              ["help",    "🆘", "Help / Report"],
            ].map(([id, ic, lbl]) => (
              <button key={id} onClick={() => { setPage(id); setSideOpen(false); }}
                style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 14px", borderRadius: 12, background: page === id ? "rgba(233,69,96,.14)" : "transparent", border: `1.5px solid ${page === id ? "#e94560" : "transparent"}`, color: page === id ? "#e94560" : "#ccc", fontWeight: 800, fontSize: 14, cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}>
                <span style={{ fontSize: 19 }}>{ic}</span>{lbl}
              </button>
            ))}

            <div style={{ flex: 1 }} />

            <button onClick={logout}
              style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 14px", borderRadius: 12, background: "rgba(239,68,68,.08)", border: "1.5px solid #ef444433", color: "#ef4444", fontWeight: 800, fontSize: 14, cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}>
              <span style={{ fontSize: 19 }}>🚪</span>Logout
            </button>

            <div style={{ marginTop: 14, fontSize: 10, color: "#252540", textAlign: "center", letterSpacing: 1 }}>QuizRupee · v1.0</div>
          </div>
        </div>
      )}

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
