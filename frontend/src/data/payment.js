(() => {
  const API_BASE = "https://bakongkhqr-73jw.onrender.com";
  const $ = (id) => document.getElementById(id);
  const TEXT = {
    unpaid: "កំពុងរង់ចាំការស្កេន…",
    scanned: "បានស្កេនហើយ! សូមបញ្ជាក់ការទូទាត់ក្នុងកម្មវិធីធនាគារ",
    paid: "ទូទាត់ជោគជ័យ",
    expired: "QR ផុតកំណត់",
  };
  const ERRORS = {
    invalid_request: "ចំនួនទឹកប្រាក់មិនត្រឹមត្រូវ",
    too_many_requests: "សំណើច្រើនពេក សូមរង់ចាំបន្តិចហើយសាកម្តងទៀត",
    payment_provider_timeout: "ប្រព័ន្ធទូទាត់ឆ្លើយតបយឺត សូមសាកម្តងទៀត",
    payment_provider_maintenance:
      "ប្រព័ន្ធទូទាត់កំពុងថែទាំ សូមសាកម្តងទៀតពេលក្រោយ",
  };

  const dialog = $("qrDialog");
  let current = null,
    remaining = 600,
    pollTimer = null,
    tickTimer = null;

  const fmt = (s) =>
    `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  const setStatus = (s) => {
    $("status").textContent = TEXT[s] || s;
    $("status").dataset.s = s;
  };
  const stop = () => {
    clearTimeout(pollTimer);
    clearInterval(tickTimer);
  };

  function showPayView() {
    $("payView").hidden = false;
    $("doneView").hidden = true;
  }
  function showDoneView() {
    $("payView").hidden = true;
    $("doneView").hidden = false;
  }

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

  function finish(paid) {
    stop();
    $("doneIcon").textContent = paid ? "✅" : "⏰";
    $("doneTitle").textContent = paid ? TEXT.paid : TEXT.expired;
    $("doneMsg").textContent = paid
      ? "អរគុណ! ការបញ្ជាទិញរបស់អ្នកត្រូវបានបញ្ជាក់។"
      : "សូមបង្កើត QR ថ្មី ដើម្បីបន្តការទូទាត់។";
    showDoneView();
  }

  async function poll() {
    try {
      const s = await api(`/api/payments/${current.md5}/status`);
      remaining = s.remainingSeconds;
      setStatus(s.status);
      if (s.status === "paid") return finish(true);
      if (s.status === "expired") return finish(false);
      pollTimer = setTimeout(poll, current.pollIntervalMs || 4000);
    } catch (e) {
      if (e.status === 404) return finish(false);
      pollTimer = setTimeout(poll, Math.max(e.retryAfter * 1000, 6000));
    }
  }

  async function createPayment() {
    const amount = parseFloat($("amount").value);
    $("err").textContent = "";
    if (!(amount >= 0.01)) {
      $("err").textContent = "សូមបញ្ចូលចំនួនទឹកប្រាក់ចាប់ពី 0.01";
      return;
    }

    const btn = $("create");
    btn.disabled = true;
    btn.textContent = "កំពុងបង្កើត…";
    try {
      // ក្នុងហាងពិត server គួរកំណត់ amount/orderId ពីកន្ត្រកទំនិញ មិនមែនពី browser ទេ
      current = await api("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: `ORD-${Date.now()}`, amount }),
      });

      $("amtLabel").textContent = amount.toFixed(2);
      const img = $("qrImg");
      const ok =
        typeof current.image === "string" &&
        current.image.startsWith("data:image/");
      img.hidden = !ok;
      $("qrFallback").hidden = ok;
      if (ok) img.src = current.image;

      const dl = $("deeplink");
      const hasLink =
        typeof current.deeplink === "string" &&
        current.deeplink.startsWith("https://");
      dl.hidden = !hasLink;
      if (hasLink) dl.href = current.deeplink;

      remaining = 600;
      $("timer").textContent = fmt(remaining);
      setStatus("unpaid");
      showPayView();
      dialog.showModal();

      tickTimer = setInterval(() => {
        remaining = Math.max(0, remaining - 1);
        $("timer").textContent = fmt(remaining);
        if (remaining === 0) finish(false);
      }, 1000);
      pollTimer = setTimeout(poll, current.pollIntervalMs || 4000);
    } catch (e) {
      $("err").textContent = ERRORS[e.message] || "មានបញ្ហា សូមសាកម្តងទៀត";
    } finally {
      btn.disabled = false;
      btn.textContent = "បង្កើត QR";
    }
  }

  $("create").addEventListener("click", createPayment);
  $("amount").addEventListener("keydown", (e) => {
    if (e.key === "Enter") createPayment();
  });
  $("closeDialog").addEventListener("click", () => dialog.close());
  $("again").addEventListener("click", () => {
    stop();
    current = null;
    dialog.close();
  });
  dialog.addEventListener("close", () => stop());
})();
