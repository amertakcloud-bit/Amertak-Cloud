// Turns an ApiError/Error into a user-facing message in the current language.
// Looks up `err_<CODE>` in the translations first, then falls back to the server message.
export function friendlyError(err, t) {
  const code = err?.code;
  if (code && code !== "ERROR") {
    const key = `err_${code}`;
    const tr = t(key);
    if (tr && tr !== key) return tr;
  }
  return err?.message || t("err_UNKNOWN");
}
