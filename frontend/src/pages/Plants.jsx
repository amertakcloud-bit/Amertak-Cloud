import { useState, useEffect } from "react";
import plantData from "../data/plantsdata";
import PlanCards from "../components/PlanCards";
import CustomPlanCard from "../components/CustomPlanCard";
import Payment from "../components/Payment";
import { useLanguage } from "../context/LanguageContext";
import { useAuth } from "../context/AuthContext";
import api from "../services/api";

const CUSTOM_RATE = 300; // tokens per $1 (same rate as the server)
const CUSTOM_MIN_TOKENS = 30; // $0.10 minimum price

function Plants() {
    const { t } = useLanguage();
    const { refreshUser } = useAuth();
    const [selected, setSelected] = useState(null);
    const [payOpen, setPayOpen] = useState(false);
    const [customTokens, setCustomTokens] = useState("30"); // default = minimum
    const [promoCode, setPromoCode] = useState(""); // promo code field
    const [promoStatus, setPromoStatus] = useState({ type: "", message: "" });
    const [isApplyingPromo, setIsApplyingPromo] = useState(false);

    useEffect(() => {
    // Re-trigger AOS animations after route change
    if (typeof window !== "undefined" && window.AOS) {
      window.AOS.refresh();
    }
  }, []);

  useEffect(() => {
        if (!promoStatus.message) return;

        const timeoutId = window.setTimeout(() => {
            setPromoStatus({ type: "", message: "" });
        }, 3000);

        return () => window.clearTimeout(timeoutId);
    }, [promoStatus.message]);

    // Open the KHQR payment dialog for the chosen plan.
    const openPayment = (plant) => {
        setSelected(plant);
        setPayOpen(true);
    };

    // Open the dialog for the custom plan (tokens typed by the user).
    const openCustomPayment = () => {
        const tokens = Number(customTokens);
        if (!Number.isInteger(tokens) || tokens < CUSTOM_MIN_TOKENS) return;

        const price = Math.round((tokens / CUSTOM_RATE) * 100) / 100;
        setSelected({
            id: "custom",
            plant: `Custom (${tokens})`,
            price: String(price),
            token: String(tokens),
        });
        setPayOpen(true);
    };

    const handleApplyPromo = async () => {
        const code = promoCode.trim();
        if (!code) {
            setPromoStatus({ type: "error", message: "Please enter a promo code." });
            return;
        }

        setIsApplyingPromo(true);
        setPromoStatus({ type: "", message: "" });

        try {
            const response = await api.post("/promo-codes/redeem", { code });
            setPromoStatus({
                type: "success",
                message: response?.data?.message || `Promo code applied! +${response?.data?.applied || 0} tokens.`,
            });
            setPromoCode("");
            await refreshUser();
        } catch (error) {
            setPromoStatus({
                type: "error",
                message: error?.message || "Unable to apply this promo code.",
            });
        } finally {
            setIsApplyingPromo(false);
        }
    };

    return (
        <div className="page">
            <h1 className="page-heading" data-aos="fade-in" data-aos-delay="100">
                {t('plantTitle')}
            </h1>
            <p className="page-subtitle" data-aos="fade-in" data-aos-delay="150">
                {t('plantSub')}
            </p>

            {/* Promo Code Input */}
            <div className="promo-code-section" data-aos="fade-in" data-aos-delay="200">
                <input
                    type="text"
                    className="promo-code-input"
                    placeholder="Enter promo code"
                    value={promoCode}
                    onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                    maxLength="50"
                />
                <button
                    type="button"
                    className="promo-code-button"
                    onClick={handleApplyPromo}
                    disabled={isApplyingPromo || !promoCode.trim()}
                >
                    <i className="ri-flashlight-fill"></i>
                    <span>{isApplyingPromo ? "Applying..." : "Apply"}</span>
                </button>
                {/*
                    {promoCode && <span className="promo-code-badge">{promoCode}</span>}
                */}
            </div>
            {promoStatus.message && (
                <div className={`promo-code-feedback ${promoStatus.type}`} role="status" data-aos="fade-down" data-aos-delay="100">
                    <i className="ri-error-warning-line"></i>
                    <span>{promoStatus.message}</span>
                </div>
            )}

            {/* Subscription */}
            <div className="flex center" data-aos="fade-in" data-aos-delay="200">
                <i className="ri-stack-line"></i>
                <span>{t('choosePlans')}</span>
            </div>

            <div className="plant-container" data-aos="fade-up" data-aos-delay="250">
                {plantData.map((p) => (
                    <PlanCards
                        key={p.id}
                        plant={p.plant}
                        token={p.token}
                        freeToken={p.freeToken}
                        price={p.price}
                        icon={p.icon}
                        sizeUpload={p.sizeUpload}
                        payId={p.payId}
                        buyPay={p.buyPay}
                        buyBtn={p.buyBtn}
                        aosDelay={p.aosDelay}
                        paymentDialog={() => openPayment(p)}
                    />
                ))}
            </div>

            {/* Custom */}
            <div className="flex center" data-aos="fade-up" data-aos-delay="100">
                <i className="ri-edit-box-line"></i>
                <span>{t('customPlan')}</span>
            </div>
            <div className="plant-container" data-aos="fade-up" data-aos-delay="300">
                {/* Custom plan: user picks the token amount (≥ 30 = ≥ $0.10) */}
                <CustomPlanCard
                    tokens={customTokens}
                    onTokensChange={setCustomTokens}
                    onBuy={openCustomPayment}
                />
            </div>

            <Payment
                open={payOpen}
                amount={selected ? parseFloat(selected.price) : 0}
                planId={selected ? selected.id : ""}
                customTokens={selected && selected.id === "custom" ? Number(selected.token) : null}
                label={selected ? selected.plant : ""}
                promoCode={promoCode}
                onClose={() => setPayOpen(false)}
            />
        </div>
    );
}

export default Plants;
