import { useEffect, useRef, useState } from "react";
import { useLanguage } from "../context/LanguageContext";
import { useAuth } from "../context/AuthContext";
import { NavLink } from "react-router-dom";
import { motion } from "motion/react";
import http from "../services/api";

const API_BASE = "https://bakongkhqr-73jw.onrender.com";

// status -> translation key
const STATUS_KEY = {
  unpaid: "payUnpaid",
  scanned: "payScanned",
  paid: "payPaid",
  expired: "payExpired",
};

// API error code -> translation key
const ERR_KEY = {
  invalid_request: "errInvalidRequest",
  too_many_requests: "errTooManyRequests",
  payment_provider_timeout: "errPaymentProviderTimeout",
  payment_provider_maintenance: "errPaymentProviderMaintenance",
};

// Thin fetch wrapper: throws an Error carrying .status and .retryAfter on failure.
async function api(path, opts) {
  const res = await fetch(API_BASE + path, opts);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const e = new Error(body.error || "request_failed");
    e.status = res.status;
    e.retryAfter = Number(res.headers.get("Retry-After")) || 0;
    throw e;
  }
  return body;
}

const fmtTime = (s) =>
  `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

const DEFAULT_SECONDS = 600;

/**
 * KHQR payment dialog (ported from test.html to React).
 *
 * @param {boolean}  open    whether the modal dialog is shown
 * @param {number}   amount  amount to charge (from the selected plan)
 * @param {string}   label   plan name shown in the header
 * @param {function} onClose called when the dialog should close
 */
function Payment({
  open,
  amount = 0,
  label = "",
  planId = "",
  customTokens = null,
  promoCode = "",
  onClose = () => {},
  onPaid = () => {},
}) {
  const { t } = useLanguage();
  const { user, refreshUser } = useAuth();

  const dialog = useRef(null);
  const openRef = useRef(open);
  const [rendered, setRendered] = useState(false);
  const [visible, setVisible] = useState(false);
  const created = useRef(false); // guards against duplicate POST (StrictMode)
  const mounted = useRef(true);
  const current = useRef(null); // latest payment record from the API
  const timers = useRef({ poll: null, tick: null });
  const claimRan = useRef(false); // claim tokens at most once per payment

  const [view, setView] = useState("pay"); // "pay" | "done"
  const [ready, setReady] = useState(false); // payment created successfully
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [image, setImage] = useState("");
  const [deeplink, setDeeplink] = useState("");
  const [remaining, setRemaining] = useState(DEFAULT_SECONDS);
  const [status, setStatus] = useState("unpaid");
  const [paid, setPaid] = useState(null); // true = paid, false = expired
  const [claiming, setClaiming] = useState(false);
  const [claimData, setClaimData] = useState(null); // { tokens, added, planName }
  const [claimError, setClaimError] = useState("");

  const clearTimers = () => {
    if (timers.current.poll) {
      clearTimeout(timers.current.poll);
      timers.current.poll = null;
    }
    if (timers.current.tick) {
      clearInterval(timers.current.tick);
      timers.current.tick = null;
    }
  };

  const stopAll = () => {
    clearTimers();
    created.current = false;
    current.current = null;
  };

  function finish(isPaid) {
    clearTimers();
    setPaid(isPaid);
    setView("done");
    // Payment succeeded → ask OUR server to verify it and credit the tokens.
    if (isPaid) claimTokens();
  }

  // Asks the API to verify the payment with the provider and add the plan's
  // tokens to the signed-in user's account. Safe to retry on failure.
  async function claimTokens() {
    const c = current.current;
    if (!c?.md5 || claimRan.current) return;
    claimRan.current = true;

    setClaiming(true);
    setClaimError("");
    try {
      const payload = await http.post("/payments/claim", { md5: c.md5 });
      if (!mounted.current) return;
      setClaimData(payload?.data || null);
      refreshUser(); // refresh AuthContext so Header/Profile/Dashboard update
      onPaid?.(payload?.data || null);
    } catch (e) {
      if (!mounted.current) return;
      setClaimError(e.message || t("payClaimFailed"));
    } finally {
      if (mounted.current) setClaiming(false);
    }
  }

  function retryClaim() {
    claimRan.current = false;
    claimTokens();
  }

  function resetClaim() {
    claimRan.current = false;
    setClaimData(null);
    setClaimError("");
    setClaiming(false);
  }

  const schedulePoll = (ms) => {
    timers.current.poll = setTimeout(poll, ms);
  };

  async function poll() {
    const c = current.current;
    if (!c || !mounted.current) return;
    try {
      const s = await api(`/api/payments/${c.md5}/status`);
      if (!mounted.current) return;
      setRemaining(s.remainingSeconds);
      setStatus(s.status);
      if (s.status === "paid") return finish(true);
      if (s.status === "expired") return finish(false);
      schedulePoll(c.pollIntervalMs || 4000);
    } catch (e) {
      if (!mounted.current) return;
      if (e.status === 404) return finish(false);
      schedulePoll(Math.max(e.retryAfter * 1000, 6000));
    }
  }

  async function startPayment() {
    if (created.current) return;
    created.current = true;

    clearTimers();
    setView("pay");
    setPaid(null);
    setReady(false);
    setError("");
    resetClaim();
    setCreating(true);

    // Tokens are credited to an account → a signed-in user is required.
    if (!user) {
      setError(t("payLoginRequired"));
      setCreating(false);
      created.current = false;
      return;
    }

    if (!(Number(amount) >= 0.01)) {
      setError(t("payEnterAmount"));
      setCreating(false);
      created.current = false;
      return;
    }

    // Custom plan: at least 30 tokens (price ≥ $0.10). The server re-checks it.
    if (
      planId === "custom" &&
      !(Number.isInteger(Number(customTokens)) && Number(customTokens) >= 30)
    ) {
      setError(t("customMinPrice"));
      setCreating(false);
      created.current = false;
      return;
    }

    try {
      // Create the payment through OUR API: the amount and token reward come
      // from the server-side plan table (planId), never from the browser.
      const payload = await http.post(
        "/payments",
        planId === "custom"
          ? { planId, tokens: Number(customTokens), promoCode }
          : { planId, promoCode },
      );
      if (!mounted.current) return;
      const data = payload?.data || {};

      current.current = data;
      const okImg =
        typeof data.image === "string" && data.image.startsWith("data:image/");
      setImage(okImg ? data.image : "");
      const okLink =
        typeof data.deeplink === "string" &&
        data.deeplink.startsWith("https://");
      setDeeplink(okLink ? data.deeplink : "");
      setRemaining(DEFAULT_SECONDS);
      setStatus("unpaid");
      setReady(true);

      timers.current.tick = setInterval(() => {
        setRemaining((r) => Math.max(0, r - 1));
      }, 1000);
      schedulePoll(data.pollIntervalMs || 4000);
    } catch (e) {
      if (!mounted.current) return;
      // Provider error codes are snake_case; our API sends readable sentences.
      const isCode = /^[a-z_]+$/.test(e.message || "");
      setError(
        isCode
          ? t(ERR_KEY[e.message] || "payErrorGeneric")
          : e.message || t("payErrorGeneric"),
      );
      created.current = false;
    } finally {
      if (mounted.current) setCreating(false);
    }
  }
  // Closing is animated: tell the parent (open → false); the effect below fades the
  // dialog out and only then calls the native d.close().
  const requestClose = () => {
    stopAll();
    onClose();
  };

  // Native close that we did NOT trigger (should not happen: Esc is intercepted).
  function handleNativeClose() {
    if (openRef.current) requestClose();
  }

  // Mount/unmount bookkeeping + timer cleanup.
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      clearTimers();
    };
  }, []);

  // Open/close the dialog and drive the payment lifecycle.
  // rendered → <dialog> exists; visible → CSS transition state (data-state="open").
  useEffect(() => {
    openRef.current = open;
    let raf = 0;
    let timer = 0;
    if (open) {
      setRendered(true);
      raf = requestAnimationFrame(() => {
        const d = dialog.current;
        if (d && !d.open) d.showModal();
        raf = requestAnimationFrame(() => setVisible(true)); // next frame → transition runs
      });
      startPayment();
    } else {
      stopAll();
      setVisible(false);
      timer = window.setTimeout(() => {
        const d = dialog.current;
        if (d && d.open) d.close();
        setRendered(false);
      }, 260);
    }
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Countdown reached zero -> expired.
  useEffect(() => {
    if (open && view === "pay" && remaining <= 0) finish(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, view, remaining]);

  return (
    <>
      {rendered && (
        <dialog
          className="qr-dialog"
          data-state={visible ? "open" : "closed"}
          ref={dialog}
          onClose={handleNativeClose}
          onCancel={(e) => {
            e.preventDefault(); // Esc → animated close instead of an instant native close
            requestClose();
          }}
        >
          <motion.div
            className="pay-view"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="qr-head">
              <span className="qr-label" style={{ display: "none" }}>
                {label}
              </span>
              <button
                type="button"
                className="close"
                onClick={requestClose}
                aria-label={t("payClose")}
                style={{
                  position: "absolute",
                  right: ".5rem",
                  top: ".5rem",
                }}
              >
                <i className="ri-close-line"></i>
              </button>
            </div>

            {ready ? (
          <>
            <div className="amt" style={{ display: "none"}}>{Number(amount).toFixed(2)}</div>

            {image ? (
              <img className="qr" src={image} alt="KHQR" />
            ) : (
              <p className="qr-fallback">{t("payQrFallback")}</p>
            )}

            <div className="flex align" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
              <p className="expires">
                <span className="timer">{t("payExpiresIn")}{" "}{fmtTime(remaining)}</span>
              </p>
                <span>|</span>
              <div className="status" data-s={status} aria-live="polite">
                {t(STATUS_KEY[status] || "payUnpaid")}
              </div>
            </div>

            {deeplink ? (
              <a
                className="btn"
                href={deeplink}
                target="_blank"
                rel="noopener noreferrer"
              >
                <i className="ri-flashlight-fill"></i>
                <span>{t("payOpenBank")}</span>
              </a>
            ) : null}
          </>
        ) : creating ? (
          <p className="qr-fallback">…</p>
        ) : null}

        {error ? (
          <div className="err" role="alert">
            <div className="icon" style={{
                color: "red",
                display: "flex",
                margin: "0 auto",
                alignItems: "center",
                justifyContent: "center",
                background: "#fc00001e",
                width: "30px",
                height: "30px",
                fontSize: "20px",
                padding: "1.5rem",
                borderRadius: "100px",
                }}>
              <i className="ri-error-warning-line"></i>
            </div>
            <p>{error}</p>

            <button style={{ marginRight: '0px', borderRadius: '10px'}} onClick={requestClose}>
              <i className="ri-close-line" style={{ borderRadius: '7px'}}></i>
              <span>{t('close')}</span>
            </button>
          </div>
        ) : null}
      {/*</div>*/}

      <div className="pay-view" hidden={view !== "done"}>
        <div className="big">{paid ? "✅" : "⏰"}</div>
        <h1>{t(paid ? "payPaid" : "payExpired")}</h1>
        <p>{t(paid ? "payPaidMsg" : "payExpiredMsg")}</p>

        {/* Tokens credited to the user's account */}
        {paid && claiming ? (
          <div className="token-award" role="status">
            <i className="ri-loader-4-line is-spinning" aria-hidden="true"></i>
            <span>{t("payClaiming")}</span>
          </div>
        ) : null}

        {paid && claimData ? (
          <div className="token-award" role="status">
            <span className="token-award-amount">
              <i className="ri-price-tag-3-line" aria-hidden="true"></i>
              {claimData.added > 0
                ? `+${claimData.added}`
                : claimData.tokens}{" "}
              {t("tokens")}
            </span>
            <span className="token-award-total">
              {t("tokenBalance")}: {claimData.tokens}
            </span>
          </div>
        ) : null}

        {paid && claimError ? (
          <div className="token-award error" role="alert">
            <span>{claimError}</span>
            <button
              type="button"
              className="btn token-retry"
              onClick={retryClaim}
            >
              <i className="ri-refresh-line" aria-hidden="true"></i>{" "}
              {t("retry")}
            </button>
          </div>
        ) : null}

        <button type="button" className="btn" onClick={requestClose}>
          {t("payAgain")}
        </button>
      </div>
      </motion.div>
    </dialog>
      )}
    </>
  );
}

export default Payment;
