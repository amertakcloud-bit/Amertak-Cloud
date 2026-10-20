# ⭐ Deploy ជា Project តែមួយ (Domain តែមួយ: https://amertakcloud.vercel.app)

Repo មាន `vercel.json`, `package.json` និង `api/index.js` នៅ root រួចហើយ។ Frontend (static) និង Backend (`/api/*`) ដំណើរការក្នុង project Vercel តែមួយ ហើយ cookie login ដំណើរការធម្មតា (domain តែមួយ)។

1. Push repo ទាំងមូល (`backend/`, `frontend/`, `api/`, `vercel.json`, `package.json`) ទៅ GitHub។
2. Vercel → **Add New → Project** → ជ្រើស repo → **Root Directory = `./` (root)** → Framework: **Other** (Vercel ប្រើ `vercel.json` ដោយខ្លួនឯង) → Deploy។
3. ដាក់ Environment Variables (**មិនត្រូវដាក់ `VITE_API_URL`** — frontend ប្រើ `/api` ដោយស្វ័យប្រវត្តិ)៖

```
NODE_ENV=production
CLIENT_URL=https://amertakcloud.vercel.app
SERVER_URL=https://amertakcloud.vercel.app
SESSION_SECRET=<random វែង>
MONGODB_URI=...
CLOUD_MONGODB_URI=...
GEMINI_API_KEY=...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_CALLBACK_URL=https://amertakcloud.vercel.app/api/auth/google/callback
```
4. Google Cloud Console → Authorized redirect URI = `https://amertakcloud.vercel.app/api/auth/google/callback`។
5. Redeploy រួចសាក `https://amertakcloud.vercel.app/api/health`។

> ផ្នែកខាងក្រោមពណ៌នាការ deploy ជា project ពីរ (ជម្រើសចាស់) — មិនចាំបាច់ប្រើទេ។

---

# Deployment.md — ដាក់ AmertakCloud លើ Vercel (Backend + Frontend ក្នុង Workspace តែមួយ)

Repo តែមួយ ប៉ុន្តែបង្កើត **Vercel Project ពីរ** (Backend មួយ, Frontend មួយ) ដោយប្រើ *Root Directory* ផ្សេងគ្នា។

```
AmertakCloud/
├── backend/     → Vercel Project #1  (Express API, serverless)   Root Directory = backend
├── frontend/    → Vercel Project #2  (React + Vite, static)      Root Directory = frontend
└── Deployment.md
```

> ⚠️ **សុវត្ថិភាព — ធ្វើមុនគេ។** ឯកសារ `.env` ក្នុង zip ដើមរបស់អ្នក (និង `.env.example` ដើម) មាន **Telegram bot token ពិត**។ ឯកសារទាំងនេះត្រូវបានលុបចេញពី zip ថ្មី ប៉ុន្តែ token នោះធ្លាប់នៅក្នុងឯកសារដែលអ្នកបានចែករំលែក។ សូមទៅ **@BotFather → /revoke** ដើម្បីបង្កើត token ថ្មី ហើយប្តូរ `SESSION_SECRET`, Google secret និង Mongo password ប្រសិនបើធ្លាប់ប្រើក្នុង `.env` នោះ។ កុំ commit `.env` ទៅ GitHub ឡើយ (`.gitignore` បានការពាររួចហើយ)។

---

## 1. អ្វីដែលត្រូវមុន

| ត្រូវការ | ចំណាំ |
|---|---|
| GitHub account + repo | Vercel deploy ពី Git |
| Vercel account | Hobby (ឥតគិតថ្លៃ) គ្រប់គ្រាន់សម្រាប់ចាប់ផ្តើម |
| MongoDB Atlas (ឥតគិតថ្លៃ M0) | សម្រាប់ login / payment / admin |
| Gemini API key (ស្រេចចិត្ត) | សម្រាប់ SRT និង Image→Prompt — អ្នកប្រើអាចដាក់ key ខ្លួនឯងក្នុងគេហទំព័របាន |

### MongoDB Atlas
1. Create cluster (M0) → **Database Access** → បង្កើត user + password។
2. **Network Access** → *Add IP Address* → **Allow access from anywhere (`0.0.0.0/0`)** (Vercel មិនមាន IP ថេរទេ)។
3. **Connect → Drivers** → ចម្លង connection string ដាក់ក្នុង `MONGODB_URI` (ប្តូរ `<password>`, ហើយបន្ថែមឈ្មោះ DB ឧ. `/amertak_cloud`)។

---

## 2. Push ទៅ GitHub

```bash
cd AmertakCloud
git init
git add .
git commit -m "AmertakCloud: backend + frontend"
git branch -M main
git remote add origin https://github.com/<you>/AmertakCloud.git
git push -u origin main
```

ពិនិត្យថា `git status` មិនបង្ហាញ `.env`។ បន្ទាប់ពី `npm install` ដំបូងក្នុងថត `backend/` និង `frontend/` សូម commit `package-lock.json` ផងដែរ។

---

## 3. Deploy Backend (Project #1)

1. Vercel → **Add New → Project** → import repo។
2. **Root Directory**: `backend` (ចុច Edit)។
3. **Framework Preset**: `Other`។ Build/Output ទុកទទេ។ (`backend/vercel.json` បញ្ជូនគ្រប់ request ទៅ `api/index.js` ដែលដំណើរការ Express។)
4. **Environment Variables** (Production + Preview):

| Name | តម្លៃ | ចំណាំ |
|---|---|---|
| `NODE_ENV` | `production` | ធ្វើឱ្យ cookie ជា `Secure` + `SameSite=None` |
| `MONGODB_URI` | `mongodb+srv://…` | ពី Atlas |
| `CLOUD_MONGODB_URI` | `mongodb+srv://…/cloudshare` | **ថ្មី** — MongoDB ដាច់ដោយឡែកសម្រាប់ CloudShare |
| `SESSION_SECRET` | random វែង | `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `CLIENT_URL` | `https://<frontend>.vercel.app` | គ្មាន `/` ចុងក្រោយ។ ដាក់ច្រើនបាន បំបែកដោយ `,` |
| `SERVER_URL` | `https://<backend>.vercel.app` | |
| `GEMINI_API_KEY` | key របស់អ្នក (ស្រេចចិត្ត) | **មានតែអ្នកប្រើដែលចូលគណនីប៉ុណ្ណោះដែលប្រើវាបាន** |
| `GEMINI_TRANSCRIBE_MODEL` | `gemini-3.5-transcribe` | ស្រេចចិត្ត |
| `GEMINI_MODEL` | `gemini-3.8-flash` | ស្រេចចិត្ត |
| `PAYMENT_PROVIDER_URL` | `https://bakongkhqr-73jw.onrender.com` | |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | ពី Google Cloud | ប្រសិនបើប្រើ Google login |
| `GOOGLE_CALLBACK_URL` | `https://<backend>.vercel.app/api/auth/google/callback` | |
| `TELEGRAM_BOT_ID` / `TELEGRAM_BOT_TOKEN` / `TELEGRAM_BOT_USERNAME` | token **ថ្មី** | ប្រសិនបើប្រើ Telegram login |
| `TELEGRAM_CALLBACK_URL` | `https://<backend>.vercel.app/api/auth/telegram/callback` | |
| `MAX_UPLOAD_MB` | `4` | កុំលើស 4 លើ Vercel |

5. **Deploy**។ បន្ទាប់មកសាកល្បង:

```bash
curl https://<backend>.vercel.app/api/health
# {"success":true,"status":"ok",...,"database":true}
curl https://<backend>.vercel.app/api/tools
# បញ្ជី tool + voices + formats
curl https://<backend>.vercel.app/api/tts/voices
```

> បើ `maxDuration: 300` ក្នុង `backend/vercel.json` ធ្វើឱ្យ build បរាជ័យ (plan/ការកំណត់ Fluid compute មិនអនុញ្ញាត) សូមបន្ថយទៅ `60`។ ពេល SRT ដំណើរការ ម្តងម្ដាល request ត្រូវការតែប៉ុន្មានវិនាទី (chunk ≈ 90 វិនាទីនៃសម្លេង) ដូច្នេះ `60` ក៏គ្រប់គ្រាន់ដែរ។

---

## 4. Deploy Frontend (Project #2)

1. Vercel → **Add New → Project** → import repo **ដដែល** ម្តងទៀត។
2. **Root Directory**: `frontend`។ Framework: **Vite** (រកឃើញដោយស្វ័យប្រវត្តិ)។
3. **Environment Variables**:

| Name | តម្លៃ |
|---|---|
| `VITE_API_URL` | `https://<backend>.vercel.app/api` |

4. **Deploy**។ `frontend/vercel.json` មាន rewrite ទៅ `index.html` ដូច្នេះ URL ដូចជា `/tools/srt` ដំណើរការពេល refresh។
5. ត្រលប់ទៅ Backend project → ដាក់ `CLIENT_URL` = URL ពិតរបស់ frontend → **Redeploy** (env vars ប្រើបានតែពេល deploy ថ្មី)។

> `VITE_*` ត្រូវបានបញ្ចូលពេល **build** ដូច្នេះរាល់ពេលប្តូរ `VITE_API_URL` ត្រូវ Redeploy frontend។

---

## 5. Cookie / Login ឆ្លង domain (សំខាន់)

Login ប្រើ HTTP-only cookie `auth_token`។ `*.vercel.app` ពីរផ្សេងគ្នាគឺជា *site* ផ្សេងគ្នា ដូច្នេះ cookie ក្លាយជា **third-party cookie**៖ ដំណើរការលើ Chrome/Edge ជាច្រើន ប៉ុន្តែ **Safari និង browser ខ្លះរារាំង** ដែលនាំឱ្យ login បាត់ពេល refresh។

**ដំណោះស្រាយត្រឹមត្រូវ:** ប្រើ custom domain ក្រោម parent តែមួយ
- Frontend → `app.yourdomain.com`
- Backend → `api.yourdomain.com`

បន្ទាប់មកកែ `CLIENT_URL=https://app.yourdomain.com`, `VITE_API_URL=https://api.yourdomain.com/api`, `GOOGLE_CALLBACK_URL`/`TELEGRAM_CALLBACK_URL`/`SERVER_URL` ឱ្យត្រូវ ហើយ Redeploy ទាំងពីរ។ (Vercel → Project → Settings → Domains។)

ឧបករណ៍ទាំងអស់ (SRT, QR, TTS, Image→Prompt, Video, Audio) **មិនត្រូវការ cookie** — មានតែ server key របស់ Gemini ប៉ុណ្ណោះដែលត្រូវការ login។

### Google OAuth
Google Cloud Console → Credentials → OAuth client → **Authorized redirect URIs** បន្ថែម `https://<backend>.vercel.app/api/auth/google/callback` (ត្រូវដូចតម្លៃ `GOOGLE_CALLBACK_URL` បេះបិទ)។

### Telegram
@BotFather → `/setdomain` → ដាក់ domain របស់ backend។

---

## 6. ដែនកំណត់របស់ Vercel ដែលអ្នកគួរដឹង

| ប្រធានបទ | អ្វីដែលកើតឡើង |
|---|---|
| **Request body ≤ 4.5 MB** | SRT ដោះស្រាយដោយ browser កាត់សម្លេងជា chunk ≤ 100 វិនាទី (~3 MB) ហើយផ្ញើម្តងមួយ។ Image→Prompt បង្រួមរូបក្នុង browser។ Export Audio: ឯកសារ ≤ 4 MB បម្លែងលើ server (MP3/M4A/OGG/WAV), ធំជាងនេះបម្លែងក្នុង browser ជា **WAV** តែប៉ុណ្ណោះ។ |
| **SRT រហូតដល់ 60 នាទី** | កំណត់ដោយ memory របស់ browser ពេល decode។ ឯកសារវែងជាងនេះ សូមកាត់ជាពីរ។ |
| **ffmpeg** | `ffmpeg-static` ត្រូវបានបញ្ចូលតាម `includeFiles` ក្នុង `backend/vercel.json` (ទំហំ bundle ≤ 250 MB)។ |
| **TTS** | ប្រើ `node-edge-tts` (pure JS) — គ្មាន Python/binary។ សំឡេងមកពី Microsoft Edge neural voices (km-KH Piseth/Sreymom)។ បើសេវាមិនឆ្លើយតប ត្រឡប់ error ច្បាស់លាស់ (គ្មានសំឡេងក្លែងក្លាយ)។ |
| **Video Downloader** | គាំទ្រ TikTok (តាម tikwm), Pinterest និងតំណឯកសារ video/audio/image ផ្ទាល់។ YouTube/Facebook/Instagram/X **មិនគាំទ្រ**។ ប្រភពទាំងនេះជាសេវាភាគីទីបី ដែលអាចផ្លាស់ប្តូរ ឬរារាំងបានគ្រប់ពេល។ តំណទាញយកមានហត្ថលេខា + ផុតកំណត់ក្រោយ 30 នាទី ហើយបដិសេធអាសយដ្ឋានឯកជន (SSRF)។ |
| **CloudShare** | ✅ ដំណើរការ ប្រសិនបើដាក់ `CLOUD_MONGODB_URI` (មូលដ្ឋានទិន្នន័យ MongoDB ដាច់ដោយឡែក)។ ឯកសារត្រូវរក្សាទុកក្នុង MongoDB។ ដែនកំណត់ Vercel: ≈ **4 MB** ក្នុងមួយឯកសារ។ បើមិនដាក់ env នេះ API ឆ្លើយ `503 STORAGE_UNAVAILABLE`។ |
| **Rate limit** | រក្សាក្នុង memory ក្នុងមួយ instance — ជាអ្នកការពារមូលដ្ឋាន មិនមែនការគ្រប់គ្រងថ្លៃច្បាស់លាស់ទេ។ |
| **Cold start** | request ដំបូងក្រោយពេលទំនេរអាចយឺត 1–3 វិនាទី (ភ្ជាប់ MongoDB)។ |

---

## 7. បញ្ជីពិនិត្យក្រោយ deploy

- [ ] `GET /api/health` → `status: ok`
- [ ] បើក frontend → ប្តូរភាសា EN/ខ្មែរ → ចំណងជើង tab ប្តូរតាមទំព័រ
- [ ] `/tools/qr` → វាយ URL → QR បង្ហាញ → ទាញយក PNG/SVG
- [ ] `/tools/tts` → វាយខ្មែរ → ចុច Generate → ចាក់បាន
- [ ] `/tools/srt` → បន្ថែម Gemini key → ផ្ទុកសម្លេងខ្លី → ទទួលបាន subtitle + timestamp → កែ → ទាញយក `.srt`
- [ ] `/tools/image-prompt` → រូបភាព → prompt
- [ ] `/tools/downloader` → តំណ TikTok → ទាញយក
- [ ] `/tools/export-audio` → ឯកសារតូច → MP3
- [ ] Register / Login / Logout / Google login (បើបានកំណត់)
- [ ] Payment dialog បើក/បិទរលូន

## 8. បញ្ហាដែលរកឃើញញឹកញាប់

| រោគសញ្ញា | មូលហេតុ | ដំណោះស្រាយ |
|---|---|---|
| Console: `CORS` blocked | `CLIENT_URL` មិនត្រូវ URL frontend | ដាក់ URL បេះបិទ (គ្មាន `/` ចុង) ហើយ Redeploy backend |
| Login ជោគជ័យ តែ refresh ចេញ | third-party cookie ត្រូវបានរារាំង | ប្រើ domain ក្រោម parent តែមួយ (ផ្នែក 5) |
| Frontend ហៅ `localhost:5000` | ភ្លេចដាក់ `VITE_API_URL` ឬមិនបាន Redeploy | ដាក់ env ហើយ Redeploy frontend |
| `503 DATABASE_UNAVAILABLE` | Atlas រារាំង IP | Network Access → `0.0.0.0/0`; ពិនិត្យ password ក្នុង URI (encode តួអក្សរពិសេស) |
| `401 LOGIN_REQUIRED` លើ SRT | គ្មាន key ផ្ទាល់ខ្លួន ហើយមិនបានចូលគណនី | ដាក់ Gemini key ក្នុងប៊ូតុង *Add key* ឬ login |
| `413` | ឯកសារ > 4.5 MB ទៅ API | SRT/Image បង្រួមដោយស្វ័យប្រវត្តិ; ឧបករណ៍ផ្សេងមើលផ្នែក 6 |
| `ffmpeg` មិនឃើញ | `includeFiles` មិនត្រូវបានអនុវត្ត | ពិនិត្យ `backend/vercel.json` ហើយ Redeploy (Clear build cache) |
| 404 ពេល refresh ទំព័រក្នុង frontend | rewrite បាត់ | ពិនិត្យ `frontend/vercel.json` ហើយ Root Directory = `frontend` |
| Function timeout | `maxDuration` ទាបពេក / Gemini យឺត | SRT ផ្ញើម្តងមួយ chunk ហើយ retry ដោយស្វ័យប្រវត្តិ; សាកម្តងទៀត |

---

## 9. Local development

```bash
# Backend  (http://localhost:5000)
cd backend
cp .env.example .env        # បំពេញ SESSION_SECRET, MONGODB_URI (ឬ npm run dev:memory)
npm install
npm run dev
npm test                    # unit tests (QR, SRT, TTS, video, audio …)

# Frontend (http://localhost:5173)
cd frontend
cp .env.example .env        # VITE_API_URL=http://localhost:5000/api
npm install
npm run dev
npm test                    # lib tests (chunker, WAV, SRT editor …)
```

ឧបករណ៍ទាំងអស់ដំណើរការដោយគ្មាន MongoDB (រក្សា `MONGODB_URI` ទទេ ឬមិនបានកំណត់) — មានតែ login/payment/admin ដែលត្រូវការវា។

## 10. API សង្ខេប (backend)

| Method | Path | Tool |
|---|---|---|
| GET | `/api/health`, `/api/tools` | ស្ថានភាព |
| GET/POST | `/api/srt/status`, `/validate-key`, `/chunk`, `/cues`, `/align`, `/export` | SRT |
| POST | `/api/tts` (`GET /api/tts/voices`) | Text → Speech |
| POST | `/api/qr` | QR |
| POST | `/api/image-prompt` | Image → Prompt |
| POST / GET | `/api/video/resolve`, `/api/video/download?token=` | Video |
| POST | `/api/audio/convert` | Export Audio |
| — | `/api/auth/*`, `/api/users/*`, `/api/payments/*`, `/api/promo-codes/*`, `/api/admin/*`, `/api/cloudshare/*` | ដើម |

Header `x-gemini-api-key` ប្រើជាមួយ `/api/srt/chunk`, `/api/srt/validate-key` និង `/api/image-prompt` ប៉ុណ្ណោះ។ Key មិនត្រូវបានរក្សាទុក ឬចុះក្នុង log ទេ (error ត្រូវបាន redact)។
