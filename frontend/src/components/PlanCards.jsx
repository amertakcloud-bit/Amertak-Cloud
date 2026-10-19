import { useLanguage } from "../context/LanguageContext";
import Tooltip from "./Tooltip";

export default function PlanCards({
  plant,
  token,
  freeToken,
  price,
  icon,
  sizeUpload,
  payId,
  paymentDialog,
  buyPay,
  buyBtn,
  aosDelay,
}) {
  const { t } = useLanguage();
  return (
    <div className="card glass" data-aos="fade-up" data-aos-delay={aosDelay}>
      <h2 data-aos="fade-in" data-aos-delay={Number(aosDelay) + 400}>
        {plant}
      </h2>
      <div className="plant-price">
        <span>{price}$</span>
      </div>

      <div className="plant-info">
        <p>
          {t("maxToken")}: {token}{" "}
        </p>
        <p>
          {t("freeToken")}: {freeToken} {t("tokenAdded")}
        </p>
        {/*
                <p>Size Upload: {sizeUpload}MB</p>
                <p></p>
                */}
      </div>

      <button type="button" onClick={paymentDialog} className={buyBtn}>
        <i
          className={
            icon ? "ri-checkbox-circle-line" : "ri-money-dollar-circle-line"
          }
        ></i>
        <span>{t(buyPay)}</span>
      </button>
    </div>
  );
}
