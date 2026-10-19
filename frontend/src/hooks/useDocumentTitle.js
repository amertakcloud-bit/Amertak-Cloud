import { useEffect } from "react";

const BRAND = "Amertak Cloud";

// Sets <title> to "Page — Amertak Cloud" (or just the brand on the home page).
export default function useDocumentTitle(title) {
  useEffect(() => {
    document.title = title && title !== BRAND ? `${title} — ${BRAND}` : BRAND;
  }, [title]);
}
