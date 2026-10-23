import { useLanguage } from "../context/LanguageContext";

// Custom plan card — the user types how many tokens they want and the price
// updates live. The same rate lives on the server (300 tokens = $1.00) and the
// minimum price is $0.10 → 30 tokens. The server re-validates everything.
const RATE = 300;
const MIN_TOKENS = 30;
const MAX_TOKENS = 5000;

function CustomPlanCard({ tokens, onTokensChange, onBuy }) {
  const { t } = useLanguage();

  const parsed = Number(tokens);
  const valid = Number.isInteger(parsed) && parsed >= MIN_TOKENS && Number.isInteger(parsed) && parsed <= MAX_TOKENS;
  const price = valid ? Math.round((parsed / RATE) * 100) / 100 : 0;

  return (
    <div className="card glass plant-custom">
      <h2>{t("customPlan")}</h2>

      <div className="plant-price">
        <span>{valid ? price.toFixed(2) : "—"}$</span>
      </div>

      <div className="plant-info">
        {/*<p>
          {t("tokens")}: {valid ? parsed : "—"}
        </p>*/}

        <label className="custom-token-input" htmlFor="custom-tokens">
          <span>{t("customTokensHint")}</span>
          <input
            id="custom-tokens"
            type="number"
            inputMode="numeric"
            min={MIN_TOKENS}
            max={MAX_TOKENS}
            step="1"
            value={tokens}
            onChange={(event) => onTokensChange(event.target.value)}
            placeholder={`${MIN_TOKENS}+`}
          />
        </label>

        <p className={valid ? "custom-hint" : "custom-hint error"}>
          {valid ? t("customRateInfo") : t("customMinPrice")}
        </p>

        <p className={valid ? "custom-hint" : "custom-hint error"}>
          {valid ? t("customTokenInfo") : t("customMaxToken")}
        </p>
      </div>

      <button type="button" onClick={onBuy} disabled={!valid}>
        <i className="ri-money-dollar-circle-line"></i>
        <span>{t("buyCustom")}</span>
      </button>
    </div>
  );
}

export default CustomPlanCard;
