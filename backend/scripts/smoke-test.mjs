// E2E smoke test for the API (run while `npm run dev` is up):
//   node scripts/smoke-test.mjs
// Covers: register → me → logout → login → profile update, duplicate email,
// invalid credentials, protected routes, payment create + claim verification.
const BASE = process.env.API_URL || "http://localhost:5000/api";
const ORIGIN = "http://localhost:5173";

let cookie = "";
let passed = 0;
let failed = 0;

function check(name, cond, extra = "") {
  if (cond) {
    passed++;
    console.log(`  OK  ${name}`);
  } else {
    failed++;
    console.log(`  FAIL ${name}${extra ? ` — ${extra}` : ""}`);
  }
}

function saveCookie(res) {
  const setCookies = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
  for (const sc of setCookies) {
    const [pair] = sc.split(";");
    const idx = pair.indexOf("=");
    const name = pair.slice(0, idx).trim();
    const value = pair.slice(idx + 1).trim();
    if (name === "auth_token") cookie = value ? `${name}=${value}` : "";
  }
}

async function req(method, path, body, withCookie = true) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      Origin: ORIGIN,
      ...(withCookie && cookie ? { Cookie: cookie } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  saveCookie(res);
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* no body */
  }
  return { status: res.status, data, res };
}

const email = `smoke+${Date.now()}@example.com`;
const password = "Sup3rSecret!";

console.log("\n— AUTH —");
{
  const r = await req("POST", "/auth/register", {
    name: "Smoke Tester",
    email,
    password,
    confirmPassword: password,
  });
  check("register -> 201", r.status === 201, `got ${r.status} ${JSON.stringify(r.data)}`);
  check("register sets HTTP-only cookie", cookie.includes("auth_token="));
  const u = r.data?.data?.user;
  check("register returns user", !!u?.email, JSON.stringify(r.data));
  check("new user tokens = 150 (free plan)", u?.tokens === 150, `got ${u?.tokens}`);
  check("password never returned", !JSON.stringify(r.data).includes("$2"));
}
{
  const r = await req("GET", "/auth/me");
  check("GET /auth/me -> 200", r.status === 200, `got ${r.status}`);
  check("/me returns same email", r.data?.data?.user?.email === email);
}
{
  const r = await req("POST", "/auth/logout");
  check("logout -> 200", r.status === 200, `got ${r.status}`);
}
{
  cookie = "";
  const r = await req("GET", "/auth/me", null, false);
  check("/me without cookie -> 401", r.status === 401, `got ${r.status}`);
}
{
  const r = await req("POST", "/auth/login", { email, password: "WrongPass1!" });
  check("login wrong password -> 401", r.status === 401, `got ${r.status}`);
  check("generic message (no user leak)", /invalid email or password/i.test(r.data?.message || ""));
}
{
  const r = await req("POST", "/auth/login", { email, password });
  check("login correct -> 200", r.status === 200, `got ${r.status} ${JSON.stringify(r.data)}`);
  check("login sets cookie again", cookie.includes("auth_token="));
}
{
  const r = await req("POST", "/auth/register", {
    name: "Dup",
    email: email.toUpperCase(),
    password,
    confirmPassword: password,
  });
  check("duplicate email -> 409", r.status === 409, `got ${r.status}`);
}
{
  const r = await req("POST", "/auth/register", { name: "X", email: "not-an-email", password: "123" });
  check("invalid input -> 400", r.status === 400, `got ${r.status}`);
}

console.log("\n— USERS —");
{
  const r = await req("GET", "/users/me");
  check("GET /users/me -> 200", r.status === 200, `got ${r.status}`);
  check("tokens present on profile", typeof r.data?.data?.user?.tokens === "number");
}
{
  const r = await req("PUT", "/users/me", { name: "Smoke Tester II" });
  check("PUT /users/me -> 200", r.status === 200, `got ${r.status}`);
  check("name updated", r.data?.data?.user?.name === "Smoke Tester II");
}
{
  cookie = "";
  const r = await req("GET", "/users/me", null, false);
  check("GET /users/me without cookie -> 401", r.status === 401, `got ${r.status}`);
  await req("POST", "/auth/login", { email, password });
}

console.log("\n— PAYMENTS + TOKENS —");
let md5 = "";
{
  const r = await req("POST", "/payments", { planId: "2" });
  check("create payment (Pro) -> 201", r.status === 201, `got ${r.status} ${JSON.stringify(r.data)}`);
  md5 = r.data?.data?.md5;
  check("returns provider md5", !!md5);
  const plan = r.data?.data?.plan;
  check("server-side plan mapping (price 1 / 300 tokens)", plan?.price === 1 && plan?.tokens === 300, JSON.stringify(plan));
}
{
  cookie = "";
  const r = await req("POST", "/payments", { planId: "2" }, false);
  check("create payment without login -> 401", r.status === 401, `got ${r.status}`);
  await req("POST", "/auth/login", { email, password });
}
{
  const r = await req("POST", "/payments", { planId: "1" });
  check("free plan rejected -> 400", r.status === 400, `got ${r.status}`);
  const r2 = await req("POST", "/payments", { planId: "99" });
  check("unknown plan rejected -> 400", r2.status === 400, `got ${r2.status}`);
}
{
  const r = await req("POST", "/payments/claim", { md5 });
  check("claim UNPAID -> 400 (server-side verify)", r.status === 400, `got ${r.status} ${JSON.stringify(r.data)}`);
}
{
  const r = await req("POST", "/payments/claim", { md5: "deadbeefdeadbeefdeadbeefdeadbeef" });
  check("claim unknown md5 -> 404", r.status === 404, `got ${r.status}`);
}
{
  const r = await req("GET", "/users/me");
  const tokens = r.data?.data?.user?.tokens;
  // Register/login credits the 150-token free plan; failed claims must not change it.
  check("tokens unchanged after failed claims (150 free plan)", tokens === 150, `got ${tokens}`);
}

console.log("\n— CUSTOM PLAN —");
{
  const r = await req("POST", "/payments", { planId: "custom", tokens: 250 });
  check("custom 250 tokens -> 201", r.status === 201, `got ${r.status} ${JSON.stringify(r.data)}`);
  const plan = r.data?.data?.plan;
  check("custom price = 0.83 (250/300)", plan?.price === 0.83, `got ${plan?.price}`);
  check("custom tokens = 250 credited later", plan?.tokens === 250, `got ${plan?.tokens}`);
}
{
  const r = await req("POST", "/payments", { planId: "custom", tokens: 30 });
  check("custom min 30 tokens -> 201 (price 0.10)", r.status === 201 && r.data?.data?.plan?.price === 0.1, `got ${r.status} ${JSON.stringify(r.data?.data?.plan)}`);
}
{
  const r = await req("POST", "/payments", { planId: "custom", tokens: 25 });
  check("custom 25 tokens -> 400 (price < $0.10)", r.status === 400, `got ${r.status}`);
}
{
  const r = await req("POST", "/payments", { planId: "custom", tokens: "abc" });
  check("custom non-integer tokens -> 400", r.status === 400, `got ${r.status}`);
}
{
  const r = await req("POST", "/payments", { planId: "custom", tokens: 450 });
  check("custom 450 tokens -> price 1.50", r.data?.data?.plan?.price === 1.5, `got ${r.data?.data?.plan?.price}`);
}
{
  const r = await req("POST", "/payments/claim", { md5: "deadbeefdeadbeefdeadbeefdeadbeef" });
  check("custom claim still requires paid status -> 404/400", r.status === 404 || r.status === 400, `got ${r.status}`);
}

console.log("\n— GOOGLE / MISC —");
{
  const r = await fetch(`${BASE}/auth/google`, { redirect: "manual", headers: { Origin: ORIGIN } });
  // 503 when OAuth is unconfigured; 302 when credentials are set in .env.
  check("GET /auth/google without creds -> 503/302", r.status === 503 || r.status === 302, `got ${r.status}`);
}
{
  const r = await fetch(`${BASE}/health`, { headers: { Origin: ORIGIN } });
  const acao = r.headers.get("access-control-allow-origin");
  check("CORS allows localhost:5173 with credentials", acao === ORIGIN, `got ${acao}`);
}
{
  const r = await fetch("http://localhost:5000/api/nope", { headers: { Origin: ORIGIN } });
  check("unknown route -> 404 centralized", r.status === 404, `got ${r.status}`);
}

console.log("\n— ADMIN —");
// Requires the seeded admin (scripts/seed-admin.js): admin@admin.com / admin123456
{
  cookie = "";
  const r = await req("POST", "/admin/auth/login", {
    email: "admin@admin.com",
    password: "admin123456",
  });
  check("admin login -> 200", r.status === 200, `got ${r.status} ${JSON.stringify(r.data)}`);
  check("admin login sets cookie", cookie.includes("auth_token="));
  check("admin role returned", r.data?.data?.user?.role === "admin");
}
{
  const r = await req("GET", "/admin/auth/me");
  check("GET /admin/auth/me -> 200", r.status === 200, `got ${r.status}`);
}
{
  const r = await req("GET", "/admin/users");
  check("GET /admin/users -> 200", r.status === 200, `got ${r.status}`);
  check("users list is array", Array.isArray(r.data?.data?.users));
}
{
  const r = await req("GET", "/admin/promo-codes");
  check("GET /admin/promo-codes -> 200", r.status === 200, `got ${r.status}`);
}
let promoId = "";
let promoUserId = "";
{
  // Expiry 30 days out so it passes the future-date validation.
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  const r = await req("POST", "/admin/promo-codes", {
    code: `SMOKE${Date.now().toString(36).toUpperCase()}`,
    type: "fixed",
    value: 25,
    maxUsers: 5,
    expiresAt,
  });
  check("create promo code -> 201", r.status === 201, `got ${r.status} ${JSON.stringify(r.data)}`);
  promoId = r.data?.data?.promoCode?.id;
}
{
  const r = await req("GET", "/admin/users");
  promoUserId = r.data?.data?.users?.[0]?._id;
  check("pick a user for promo apply", !!promoUserId, JSON.stringify(r.data));
}
{
  const before = await req("GET", "/admin/users/" + promoUserId);
  const tokensBefore = before.data?.data?.user?.tokens ?? 0;
  const r = await req("POST", `/admin/promo-codes/${promoId}/use`, { userId: promoUserId });
  check("use promo code -> 200", r.status === 200, `got ${r.status} ${JSON.stringify(r.data)}`);
  check("fixed discount applied (+25)", r.data?.data?.applied === 25, `got ${r.data?.data?.applied}`);
  check(
    "user token balance increased",
    r.data?.data?.user?.tokens === tokensBefore + 25,
    `before ${tokensBefore}, after ${r.data?.data?.user?.tokens}`
  );
}
{
  const r = await req("POST", `/admin/promo-codes/${promoId}/deactivate`);
  check("deactivate promo -> 200", r.status === 200, `got ${r.status}`);
  const r2 = await req("POST", `/admin/promo-codes/${promoId}/use`, { userId: promoUserId });
  check("inactive promo rejected -> 400", r2.status === 400, `got ${r2.status}`);
}
{
  const r = await req("POST", `/admin/promo-codes/${promoId}/activate`);
  check("activate promo -> 200", r.status === 200, `got ${r.status}`);
}
{
  // Non-admin session must be rejected (403).
  cookie = "";
  await req("POST", "/auth/register", {
    name: "Not Admin",
    email: `notadmin+${Date.now()}@example.com`,
    password,
    confirmPassword: password,
  });
  const r = await req("GET", "/admin/users");
  check("non-admin blocked -> 403", r.status === 403, `got ${r.status}`);
}
{
  cookie = "";
  const r = await req("GET", "/admin/users", null, false);
  check("admin route without cookie -> 401", r.status === 401, `got ${r.status}`);
}


console.log(`\nRESULT: ${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
