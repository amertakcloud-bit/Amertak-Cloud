import { useEffect, useMemo, useState } from "react";
import { isStaff } from "../../lib/permissions";
import { Skeleton, SkeletonChart, SkeletonRows } from "../../components/ui/Skeleton";
import { Link, Navigate } from "react-router-dom";
import { useLanguage } from "../../context/LanguageContext";
import { useAuth } from "../../context/AuthContext";
import api from "../../services/api";
import "../../styles/user-dashboard.css";

const TOOL_LABEL = {
  caption: { en: "Caption / SRT", km: "Caption / SRT", icon: "ri-closed-captioning-line" },
  cloudshare: { en: "CloudShare", km: "CloudShare", icon: "ri-cloud-line" },
  aiedit: { en: "AI video editor", km: "AI កែវីដេអូ", icon: "ri-sparkling-2-line" },
  voice: { en: "AI voice", km: "សំឡេង AI", icon: "ri-mic-line" },
  srt: { en: "Caption / SRT", km: "Caption / SRT", icon: "ri-closed-captioning-line" },
  other: { en: "Other", km: "ផ្សេងៗ", icon: "ri-apps-line" },
};
const fmtDate = (d, lang) =>
  new Date(d).toLocaleString(lang === "km" ? "km-KH" : "en-GB", { dateStyle: "medium", timeStyle: "short" });

// Pillar (bar) chart of daily token spend — pure SVG, no chart library.
function PillarChart({ data, lang }) {
  const [hover, setHover] = useState(null);
  const max = Math.max(5, ...data.map((d) => d.tokens));
  const W = 100 / data.length;
  return (
    <div className="ud-chart" role="img" aria-label="Daily token usage">
      <div className="ud-bars">
        {data.map((d, i) => (
          <div key={d.date} className="ud-col" style={{ width: `${W}%` }}
            onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(i)} onBlur={() => setHover(null)} tabIndex={0}>
            <div className={"ud-bar" + (d.tokens ? "" : " zero")} style={{ height: `${Math.max(3, (d.tokens / max) * 100)}%` }} />
            {hover === i && (
              <div className="ud-tip">{fmtDate(d.date, lang).split(",")[0]}<b>{d.tokens} tokens</b></div>
            )}
          </div>
        ))}
      </div>
      <div className="ud-axis"><span>{data[0]?.date.slice(5)}</span><span>max {max}</span><span>{data.at(-1)?.date.slice(5)}</span></div>
    </div>
  );
}

function Dashboard() {
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const lang = language === "km" ? "km" : "en";
  const [days, setDays] = useState(30);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  // Live data: loads once with skeletons, then refreshes silently every 45 s and when the tab regains focus
  // (so a balance change by an admin or a finished payment appears without a reload).
  useEffect(() => {
    if (!user || isStaff(user)) return undefined;
    let alive = true;
    const load = () => api.get("/users/dashboard", { days, tz: new Date().getTimezoneOffset() })
      .then((r) => { if (alive) { setData(r.data); setError(""); } })
      .catch((e) => { if (alive) setError((prev) => prev || e.message || "Error"); });
    load();
    const timer = setInterval(() => { if (!document.hidden) load(); }, 45000);
    const onVis = () => { if (!document.hidden) load(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { alive = false; clearInterval(timer); document.removeEventListener("visibilitychange", onVis); };
  }, [user, days]);

  const maxTool = useMemo(() => Math.max(1, ...(data?.byTool || []).map((x) => x.tokens)), [data]);

  if (!user) return <Navigate to="/login" replace />;
  if (isStaff(user)) return <Navigate to="/admin/dashboard" replace />;

  const L = (en, km) => (lang === "km" ? km : en);
  const today = data?.byDay?.at(-1)?.tokens ?? 0;

  return (
    <div className="page ud">
      <h2 className="page-heading">{t("dashboard")}</h2>
      <p className="page-subtitle">{L("Your tokens, purchases and usage.", "Token, ការទិញ និងការប្រើប្រាស់របស់អ្នក។")}</p>

      <div className="ud-stats">
        <div className="tk-card ud-stat"><i className="ri-coin-line" /><div><b>{data?.balance ?? user.tokens ?? 0}</b><span>{L("Token balance", "Token នៅសល់")}</span></div></div>
        <div className="tk-card ud-stat"><i className="ri-fire-line" /><div><b>{data ? data.spent : <Skeleton h={20} w={48} />}</b><span>{L(`Spent (${days} days)`, `ចំណាយ (${days} ថ្ងៃ)`)}</span></div></div>
        <div className="tk-card ud-stat"><i className="ri-calendar-todo-line" /><div><b>{data ? today : <Skeleton h={20} w={48} />}</b><span>{L("Spent today", "ចំណាយថ្ងៃនេះ")}</span></div></div>
        <div className="tk-card ud-stat"><i className="ri-shopping-bag-3-line" /><div><b>{data ? data.boughtTokens : <Skeleton h={20} w={48} />}</b><span>{L("Tokens bought", "Token ដែលបានទិញ")}</span></div></div>
      </div>

      <div className="ud-quick">
        {[["/tools", "ri-tools-line", L("All tools", "ឧបករណ៍ទាំងអស់")], ["/tools/cloud", "ri-cloud-line", "CloudShare"], ["/topup", "ri-coin-line", L("Buy tokens", "ទិញ token")], ["/plans", "ri-vip-crown-line", L("Plans", "កញ្ចប់")], ["/settings", "ri-settings-3-line", L("Settings & API key", "ការកំណត់ និង API key")]].map(([to, ic, label]) => (
          <Link key={to} to={to} className="tk-btn ghost"><i className={ic} />{label}</Link>
        ))}
      </div>
      <p className="tk-hint"><i className="ri-gift-line" /> {L("Many tools are free and need no login or tokens (QR, downloader, audio export, voice, image→prompt).", "ឧបករណ៍ជាច្រើនឥតគិតថ្លៃ មិនចាំបាច់ login ឬ token (QR, downloader, audio, សំឡេង, image→prompt)។")}</p>

      {error && <div className="tk-alert tk-alert-error">{error}</div>}

      <section className="tk-card ud-card">
        <header className="ud-head">
          <h3>{L("Daily token usage", "ការប្រើ token ប្រចាំថ្ងៃ")}</h3>
          <div className="tk-seg">
            {[7, 30, 90].map((d) => (
              <button key={d} type="button" className={days === d ? "active" : ""} onClick={() => setDays(d)}>{d}{L("d", " ថ្ងៃ")}</button>
            ))}
          </div>
        </header>
        {data ? <PillarChart data={data.byDay} lang={lang} /> : <SkeletonChart />}
      </section>

      <div className="ud-two">
        <section className="tk-card ud-card">
          <h3>{L("Spent per tool", "ចំណាយតាម tool")}</h3>
          {data && data.byTool.length === 0 && <p className="ud-empty">{L("No usage yet.", "មិនទាន់មានការប្រើប្រាស់។")}</p>}
          {!data && <SkeletonRows rows={4} cols={2} />}
          <ul className="ud-tools">
            {(data?.byTool || []).map((x) => {
              const m = TOOL_LABEL[x.tool] || { en: x.tool, km: x.tool, icon: "ri-apps-line" };
              return (
                <li key={x.tool}>
                  <div className="ud-tool-top"><span><i className={m.icon} /> {m[lang]}</span><b>{x.tokens}</b></div>
                  <div className="ud-meter"><i style={{ width: `${(x.tokens / maxTool) * 100}%` }} /></div>
                  <small>{x.count} {L("uses", "ដង")}</small>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="tk-card ud-card">
          <h3>{L("Purchase history", "ប្រវត្តិទិញ token")}</h3>
          {data && data.payments.length === 0 && (
            <p className="ud-empty">{L("No purchases yet.", "មិនទាន់មានការទិញ។")} <Link to="/plants">{L("Buy tokens", "ទិញ token")}</Link></p>
          )}
          {!data && <SkeletonRows rows={3} cols={2} />}
          <ul className="ud-list">
            {(data?.payments || []).map((p, i) => (
              <li key={i}>
                <div><b>{p.planName || "Tokens"}</b><small>{fmtDate(p.at, lang)}</small></div>
                <div className="ud-right"><b>+{p.tokens}</b><small>${p.price}</small></div>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="tk-card ud-card">
        <h3>{L("Recent activity", "សកម្មភាពថ្មីៗ")}</h3>
        {data && data.recent.length === 0 && <p className="ud-empty">{L("Nothing yet.", "មិនទាន់មាន។")}</p>}
        <ul className="ud-list">
          {(data?.recent || []).map((r, i) => (
            <li key={i}>
              <div><b>{(TOOL_LABEL[r.tool] || { [lang]: r.tool })[lang]}</b><small>{fmtDate(r.at, lang)}</small></div>
              <div className={"ud-right " + (r.tokens < 0 ? "refund" : "")}><b>{r.tokens < 0 ? "+" : "−"}{Math.abs(r.tokens)}</b><small>{r.tokens < 0 ? L("refund", "សងវិញ") : "token"}</small></div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

export default Dashboard;
