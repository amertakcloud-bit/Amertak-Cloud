import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useLanguage } from "../../context/LanguageContext";
import { tokensForBytes } from "../../lib/tokens";

// Shows what an action will cost (whole tokens, rounded up) and the user's balance.
export default function TokenCost({ bytes, perMB, className = "" }) {
  const { t } = useLanguage();
  const { user } = useAuth();

  if (!user) {
    return (
      <div className={`tk-alert warn ${className}`} role="status">
        <i className="ri-lock-line" /> {t("tokLogin")}{" "}
        <Link to="/login" style={{ color: "var(--primary)", fontWeight: 600 }}>{t("tokLoginBtn")}</Link>
      </div>
    );
  }

  const cost = bytes ? tokensForBytes(bytes, perMB) : 0;
  const balance = Number(user.tokens ?? 0);
  const short = cost > balance;
  return (
    <div className={`tk-hint ${className}`} role="status" style={{ display: "flex", flexWrap: "wrap", gap: "6px 14px", alignItems: "center" }}>
      <span><i className="ri-coin-line" /> {t("tokCost")}: <b>{cost || "—"}</b> {t("tokUnit")}</span>
      <span>{t("tokBalance")}: <b style={{ color: short ? "#ef4444" : undefined }}>{balance}</b></span>
      <span style={{ opacity: 0.8 }}>({t("tokPerMB").replace("{n}", String(perMB))})</span>
      {short && <Link to="/plants" style={{ color: "var(--primary)", fontWeight: 600 }}>{t("tokBuy")}</Link>}
    </div>
  );
}
