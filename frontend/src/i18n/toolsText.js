// Translations for the tool pages, feedback UI and error codes (English + Khmer).
export const en = {
  // keys the original UI used but never defined
  customMaxToken: "Maximum $16.67 (5000 tokens)", aboutUs: "About us", fastLink: "Quick links", contactUs: "Contact us", adminLogin: "Admin Login",
  // generic
  cancel: "Cancel", confirm: "Confirm", confirmTitle: "Are you sure?", delete: "Delete", remove: "Remove",
  copy: "Copy", copied: "Copied to clipboard.", copyFailed: "Could not copy. Please copy it manually.",
  download: "Download", downloaded: "Downloaded.", paste: "Paste", pasteBlocked: "Your browser blocked clipboard access. Paste with Ctrl+V.",
  play: "Play", pause: "Pause", show: "Show", hide: "Hide", cancelled: "Cancelled.",
  dropTitle: "Drag & drop a file here, or click to choose", dropHint: "Any size supported by your browser",
  Tools: "Tools", toolsTitle: "Tools", toolsSub: "Free online tools that really work — pick one to start.",

  // page titles
  Clouds: "Cloud Share", CloudShareTitle: "Cloud Share", ImageToPrompt: "Image to Prompt",
  Captions: "Subtitles", pageNotFoundTitle: "Page Not Found",

  // tool descriptions
  dImageToPrompt: "Upload an image and get a ready-to-use AI prompt (Gemini).",
  dSrt: "Turn Khmer audio or video into an editable .srt subtitle file with real timestamps.",
  dExportAudio: "Extract audio from any video and save it as MP3, M4A, OGG or WAV.",
  dTts: "Create natural Khmer speech from text (up to 3000 characters).",
  dGenerateQr: "Create QR codes for links, Wi-Fi, contacts and more — PNG or SVG.",

  // Gemini key
  keyRequired: "Gemini API key required", keyUsingYours: "Using your Gemini key", keyUsingServer: "Using the server's Gemini key (logged in)",
  keyLoginOrPaste: "Log in to use the server key, or add your own key.", keyPasteHint: "Add your own Gemini API key to use this tool.",
  keyMemoryOnly: "Your key stays in this browser tab's memory and is only sent to this site's API.",
  keyAdd: "Add key", keyChange: "Change key", keyRemove: "Remove", keyDialogTitle: "Your Gemini API key",
  keyDialogText: "Paste a key from Google AI Studio. Any key format works (AIza…, AQ.…). We check it once and never store it on the server.",
  keyBadFormat: "That doesn't look like an API key (min 8 characters, no spaces).", keyChecking: "Checking…", keySave: "Check & save",
  keySaved: "API key verified.", keyRemember: "Keep it for this browser tab only", keyGet: "Get a free key in Google AI Studio",

  // QR
  qrSub: "Create QR codes for links, Wi-Fi, contacts and more.", qrType: "QR type", qrImage: "Image", qrImgPick: "Choose an image", qrImgUploading: "Uploading…", qrImgOk: "Image stored. Your QR is ready.", qrImgType: "Use a PNG, JPG, GIF or WebP image.", qrImgBig: "Image must be 3 MB or smaller.", qrImgLogin: "Log in to upload an image for your QR code.", qrImgOpen: "open", qrImgHint: "The image is stored in your cloud storage; scanning the QR opens it.", qrUrl: "Link", qrText: "Text", qrWifi: "Wi-Fi", qrEmail: "Email",
  qrPhone: "Phone", qrSms: "SMS", qrVcard: "Contact", qrTextPh: "Type any text…", qrSsid: "Network name (SSID)", qrSecurity: "Security",
  qrNoPass: "No password", qrHidden: "Hidden network", qrSubject: "Subject", qrBody: "Message", qrMessage: "Message", qrOrg: "Company",
  qrJob: "Job title", qrWebsite: "Website", qrStyle: "Colours & size", qrForeground: "QR colour", qrBackground: "Background", qrSize: "Size",
  qrMargin: "Margin", qrEcc: "Error correction", qrTransparent: "Transparent background", qrPreviewAlt: "Generated QR code",
  qrEmpty: "Fill in the form and your QR code appears here.",

  // Image → prompt
  ipSub: "Upload an image and get a ready-to-use prompt for AI image generators.", ipDropHint: "PNG, JPG or WebP — large photos are resized automatically",
  ipBadType: "Please choose a PNG, JPG or WebP image.", ipStyle: "Prompt style", ipDetailed: "Detailed", ipMidjourney: "Midjourney", ipSd: "Stable Diffusion", ipShort: "Short",
  ipGenerate: "Generate prompt", ipWorking: "Analysing image…", ipDone: "Prompt ready.", ipFree: "Free tool — no tokens are used.", ipPrompt: "Prompt", ipNegative: "Negative prompt", ipModel: "Model",
  ipEmpty: "Your prompt appears here.", ipPreviewAlt: "Selected image",

  // Video downloader
  vdLink: "Video or image link", vdFetch: "Get download links", vdFetching: "Looking up…", vdDirect: "Direct files",
  vdNote: "Only download content you have the right to save. YouTube, Facebook, Instagram and X are not supported.",
  vdStarted: "Download started.", vdExpires: "Download links expire after 30 minutes — fetch again if one stops working.",

  // Export audio
  eaDropHint: "MP4, MOV, MKV, WebM, MP3, WAV, M4A…", eaFormat: "Output format", eaBitrate: "Quality", eaStart: "Start (optional)", eaEnd: "End (optional)",
  eaRangeBad: "Enter a valid time range, e.g. 0:30 to 1:45.", eaExport: "Export audio", eaWorking: "Converting…", eaDone: "Audio exported.",
  eaServerNote: "Converted on the server (files up to 4 MB).", eaBrowserNote: "Converted inside your browser — your file is not uploaded.",
  eaBigFile: "This file is over {mb} MB, so it will be converted in your browser as WAV.", eaWavOnly: "Files over {mb} MB are converted in your browser and can only be saved as WAV.",

  // SRT
  srtSub: "Khmer audio or video → editable subtitles with real word-level timestamps.", srtDropHint: "MP3, WAV, M4A, MP4, WebM… (up to 60 minutes)", srtLinkLabel: "…or paste a TikTok / Pinterest link", srtLinkBtn: "Fetch from link", srtLinkFetching: "Fetching…", srtLinkBad: "Enter a full link starting with https://", srtLinkNoMedia: "No audio or video was found at that link.", srtLinkFail: "Could not download that link. Try again.", srtLinkOk: "Link loaded. Press Generate.",
  srtSettings: "Subtitle settings", srtMaxChars: "Characters per line", srtMaxLines: "Lines per subtitle", srtMaxDur: "Max duration (s)", srtMinDur: "Min duration (s)", srtPause: "Split on pause (s)",
  srtGenerate: "Generate subtitles", srtWorking: "Working…", srtDone: "{n} subtitles ready.", srtStageDecode: "Reading the audio…", srtStageChunk: "Transcribing part {i} of {n}…",
  srtStageCues: "Building subtitles…", srtStageDone: "Done.", srtCues: "subtitles", srtWordLevel: "Word-level timing", srtSegLevel: "Segment-level timing (less precise)",
  srtIssues: "to check", srtWarnings: "Please review:", srtStart: "Start time", srtEnd: "End time", srtText: "Subtitle text", srtPlayCue: "Play this subtitle", srtSplit: "Split", srtMerge: "Merge with next",
  srtShift: "Shift all by (seconds)", srtShiftBtn: "Shift all", srtFixOverlaps: "Fix overlaps", srtRealign: "Re-time edited text", srtAligned: "Edited text re-aligned to the audio.",
  srtRebuild: "Rebuild", srtRebuildTitle: "Rebuild subtitles?", srtRebuildMsg: "Your manual edits will be replaced by new subtitles built with these settings.", srtRebuilt: "Subtitles rebuilt.",
  srtNoCues: "No subtitles left.", srtBom: "Add UTF-8 BOM (for older players)", srtExport: "Download .srt", srtIssuesTitle: "Some subtitles need attention",
  srtIssuesMsg: "{n} subtitle(s) have timing or text problems. Export anyway?", srtExportAnyway: "Export anyway",
  srtIssue_empty: "empty text", srtIssue_order: "end is before start", srtIssue_short: "very short", srtIssue_overlap: "overlaps the next one",

  // TTS
  ttsReady: "Audio is ready.", ttsEmpty: "Please enter some Khmer text first.", ttsChars: "characters",

  // CloudShare
  settingsAppearance: "Appearance", settingsTheme: "Theme", settingsDark: "Dark", settingsLight: "Light", settingsReduce: "Reduce animations", settingsReduceHint: "Fewer movements and shimmer effects. Good for slow phones.",
  settingsAccount: "Account", settingsPlan: "Tokens and billing", settingsGemini: "Gemini API key", settingsGeminiHint: "Used by the free Voice tool and by AI features. Saved encrypted on your account when you are logged in.",
  settingsData: "Data on this device", settingsDataHint: "Resets language, theme and animation choices stored in this browser. Your projects and account are not touched.", settingsReset: "Reset preferences", settingsDone: "Preferences reset.",
  settingsLogin: "Log in to see your account.", settingsRole: "Role", settingsTokens: "Tokens", settingsTopUp: "Top up", settingsProfile: "Edit profile", settingsLogout: "Log out", settingsLangHint: "Changes the whole site.",
  csHow: "How it works", csStep1: "Upload", csStep1d: "Choose or drop a file.", csStep2: "Pick an expiry", csStep2d: "The link can stop working after 1 hour, 1 day or 7 days.", csStep3: "Share the link", csStep3d: "Anyone with the link can download it.", csPriceNote: "Uploads cost {n} tokens per MB (rounded up).",
  csChooseFile: "Please choose a file first.",   csUnavailable: "CloudShare is not set up on this server yet (the CloudShare database is missing).",
  csTitle: "Cloud Share", csSub: "Upload a file, get a link, and share it anywhere.", csDrop: "Drag & drop your file here", csOr: "or", csBrowse: "Browse files",
  csExpires: "Link expires", csNever: "Never", cs1h: "In 1 hour", cs1d: "In 1 day", cs7d: "In 7 days", csMax: "Maximum file size", csUpload: "Upload file",
  csUploading: "Uploading…", csCancel: "Cancel", csDone: "Upload complete", csYourLink: "Your share link", csCopy: "Copy link", csOpen: "Open link", csAnother: "Upload another file",
  csFailed: "Upload failed", csRetry: "Try again", csRemove: "Remove file",
  csTooLarge: "The file is too large for this server (limit ≈ 4 MB on Vercel).", csBadResponse: "The server returned an unexpected response.",

  // Error codes (from the API)
  err_UNKNOWN: "Something went wrong. Please try again.", err_NETWORK: "Cannot reach the server. Check your connection and try again.",
  err_TOO_LARGE: "That file is too large for the server (max ≈ 4 MB per request).", err_RATE_LIMITED: "Too many requests. Please wait a few minutes.",
  err_LOGIN_REQUIRED: "Log in to use the server key, or add your own Gemini API key.", err_NO_SERVER_KEY: "The server has no Gemini key. Add your own key to continue.",
  err_NO_API_KEY: "Please add your Gemini API key.", err_INVALID_API_KEY_FORMAT: "That API key looks invalid.", err_INVALID_API_KEY: "Google rejected this API key. Check it and try again.",
  err_KEY_FORBIDDEN: "This API key is not allowed to use that model.", err_QUOTA_EXCEEDED: "The Gemini quota for this key is used up. Try again later or use another key.",
  err_MODEL_NOT_FOUND: "The Gemini model is not available for this key.", err_GEMINI_UNAVAILABLE: "Gemini is busy right now. Please try again in a moment.",
  err_EMPTY_TRANSCRIPT: "No speech was found in this audio.", err_NO_FILE: "Please choose a file.", err_CHUNK_TOO_LONG: "The audio chunk was too long.",
  err_DECODE_FAILED: "This file could not be read. Try MP3, WAV, M4A, OGG, MP4 or WebM.", err_TOO_LONG: "That recording is too long for the browser.",
  err_NO_AUDIO_API: "This browser cannot process audio.", err_EMPTY_AUDIO: "The audio is empty.", err_EMPTY_RANGE: "The selected time range is empty.",
  err_UNSUPPORTED_IMAGE: "Please use a PNG, JPG or WebP image.", err_IMAGE_UNREADABLE: "This image could not be read.",
  err_INVALID_QR_DATA: "Please check the QR content.", err_LOW_CONTRAST: "QR colours are too similar — it would not scan.", err_QR_TOO_LARGE: "That content is too long for a QR code.",
  err_INVALID_URL: "Please paste a valid link.", err_BLOCKED_URL: "That address is not allowed.", err_UNSUPPORTED_SITE: "This site is not supported. Use TikTok, Pinterest or a direct file link.",
  err_UNSUPPORTED_LINK: "That link is not a direct video, audio or image file.", err_VIDEO_NOT_FOUND: "Could not find a downloadable file at that link.",
  err_PROVIDER_UNAVAILABLE: "The source site did not respond. Please try again later.", err_TOKEN_EXPIRED: "This download link expired. Fetch the link again.", err_INVALID_TOKEN: "Invalid download link.",
  err_UNSUPPORTED_MEDIA: "That file is not a supported audio or video file.", err_CONVERT_FAILED: "Could not convert that file. It may be corrupted or have no audio.",
  err_CONVERT_TIMEOUT: "Conversion took too long. Try a shorter file.", err_FFMPEG_MISSING: "Audio conversion is not available on this server.",
  err_TTS_UNAVAILABLE: "The voice service is not reachable right now. Please try again.", err_EMPTY_TEXT: "Please enter some text.", err_TEXT_TOO_LONG: "The text is too long (max 3000 characters).",
  err_NO_DATABASE: "This feature needs the database, which is not configured.", err_DATABASE_UNAVAILABLE: "The database is unreachable. Please try again shortly.",
};

export const km = {
  customMaxToken: "អតិបរមា $16.67 (5000 ថូខេន)", aboutUs: "អំពីយើង", fastLink: "តំណរហ័ស", contactUs: "ទាក់ទងយើង", adminLogin: "ចូលជាអ្នកគ្រប់គ្រង",
  cancel: "បោះបង់", confirm: "បញ្ជាក់", confirmTitle: "តើអ្នកប្រាកដទេ?", delete: "លុប", remove: "ដកចេញ",
  copy: "ចម្លង", copied: "បានចម្លង។", copyFailed: "មិនអាចចម្លងបាន សូមចម្លងដោយដៃ។",
  download: "ទាញយក", downloaded: "បានទាញយក។", paste: "បិទភ្ជាប់", pasteBlocked: "ក្រុមហ៊ុន browser រារាំងការចូលប្រើ clipboard សូមប្រើ Ctrl+V។",
  play: "ចាក់", pause: "ផ្អាក", show: "បង្ហាញ", hide: "លាក់", cancelled: "បានបោះបង់។",
  dropTitle: "អូសឯកសារមកទីនេះ ឬចុចដើម្បីជ្រើសរើស", dropHint: "គ្រប់ទំហំដែល browser របស់អ្នកគាំទ្រ",
  Tools: "ឧបករណ៍", toolsTitle: "ឧបករណ៍", toolsSub: "ឧបករណ៍អនឡាញឥតគិតថ្លៃដែលដំណើរការពិតប្រាកដ — ជ្រើសរើសមួយដើម្បីចាប់ផ្តើម។",

  Clouds: "ចែករំលែកឯកសារ", CloudShareTitle: "ចែករំលែកឯកសារ", ImageToPrompt: "រូបភាពទៅ Prompt",
  Captions: "ចំណងជើងរង", pageNotFoundTitle: "រកមិនឃើញទំព័រ",

  dImageToPrompt: "ផ្ទុកឡើងរូបភាព ហើយទទួលបាន AI prompt សម្រាប់ប្រើភ្លាមៗ (Gemini)។",
  dSrt: "បម្លែងសម្លេង ឬវីដេអូខ្មែរទៅជាឯកសារ .srt ដែលកែបាន ជាមួយពេលវេលាពិតប្រាកដ។",
  dExportAudio: "ទាញយកសម្លេងពីវីដេអូណាមួយ ហើយរក្សាទុកជា MP3, M4A, OGG ឬ WAV។",
  dTts: "បង្កើតសម្លេងខ្មែរធម្មជាតិពីអត្ថបទ (រហូតដល់ ៣០០០ តួអក្សរ)។",
  dGenerateQr: "បង្កើត QR code សម្រាប់តំណ Wi-Fi ទំនាក់ទំនង និងច្រើនទៀត — PNG ឬ SVG។",

  keyRequired: "ត្រូវការ Gemini API key", keyUsingYours: "កំពុងប្រើ Gemini key របស់អ្នក", keyUsingServer: "កំពុងប្រើ Gemini key របស់ម៉ាស៊ីនបម្រើ (បានចូលគណនី)",
  keyLoginOrPaste: "ចូលគណនីដើម្បីប្រើ key របស់ម៉ាស៊ីនបម្រើ ឬបន្ថែម key ផ្ទាល់ខ្លួន។", keyPasteHint: "បន្ថែម Gemini API key ផ្ទាល់ខ្លួនដើម្បីប្រើឧបករណ៍នេះ។",
  keyMemoryOnly: "Key របស់អ្នកស្ថិតក្នុងអង្គចងចាំនៃផ្ទាំង browser នេះ ហើយផ្ញើទៅ API នៃគេហទំព័រនេះប៉ុណ្ណោះ។",
  keyAdd: "បន្ថែម key", keyChange: "ប្តូរ key", keyRemove: "ដកចេញ", keyDialogTitle: "Gemini API key របស់អ្នក",
  keyDialogText: "បិទភ្ជាប់ key ពី Google AI Studio។ គ្រប់ទម្រង់ key ប្រើបាន (AIza…, AQ.…)។ យើងត្រួតពិនិត្យម្តង ហើយមិនរក្សាទុកលើម៉ាស៊ីនបម្រើទេ។",
  keyBadFormat: "នេះមិនមែនជា API key ទេ (យ៉ាងតិច ៨ តួអក្សរ គ្មានដកឃ្លា)។", keyChecking: "កំពុងត្រួតពិនិត្យ…", keySave: "ត្រួតពិនិត្យ និងរក្សាទុក",
  keySaved: "បានផ្ទៀងផ្ទាត់ API key។", keyRemember: "រក្សាទុកសម្រាប់ផ្ទាំង browser នេះប៉ុណ្ណោះ", keyGet: "ទទួលបាន key ឥតគិតថ្លៃក្នុង Google AI Studio",

  qrSub: "បង្កើត QR code សម្រាប់តំណ Wi-Fi ទំនាក់ទំនង និងច្រើនទៀត។", qrType: "ប្រភេទ QR", qrImage: "រូបភាព", qrImgPick: "ជ្រើសរើសរូបភាព", qrImgUploading: "កំពុងផ្ទុកឡើង…", qrImgOk: "បានរក្សាទុករូបភាព។ QR របស់អ្នករួចរាល់។", qrImgType: "សូមប្រើរូបភាព PNG, JPG, GIF ឬ WebP។", qrImgBig: "រូបភាពត្រូវតែមានទំហំ ៣ MB ឬតូចជាងនេះ។", qrImgLogin: "សូមចូលគណនីដើម្បីផ្ទុករូបភាពឡើងសម្រាប់ QR code។", qrImgOpen: "បើក", qrImgHint: "រូបភាពត្រូវបានរក្សាទុកក្នុង cloud របស់អ្នក ហើយស្កេន QR នឹងបើករូបភាពនោះ។", qrUrl: "តំណ", qrText: "អត្ថបទ", qrWifi: "Wi-Fi", qrEmail: "អ៊ីមែល",
  qrPhone: "លេខទូរស័ព្ទ", qrSms: "SMS", qrVcard: "ទំនាក់ទំនង", qrTextPh: "វាយអត្ថបទណាមួយ…", qrSsid: "ឈ្មោះបណ្តាញ (SSID)", qrSecurity: "សុវត្ថិភាព",
  qrNoPass: "គ្មានពាក្យសម្ងាត់", qrHidden: "បណ្តាញលាក់", qrSubject: "ប្រធានបទ", qrBody: "សារ", qrMessage: "សារ", qrOrg: "ក្រុមហ៊ុន",
  qrJob: "មុខតំណែង", qrWebsite: "គេហទំព័រ", qrStyle: "ពណ៌ និងទំហំ", qrForeground: "ពណ៌ QR", qrBackground: "ផ្ទៃខាងក្រោយ", qrSize: "ទំហំ",
  qrMargin: "គែម", qrEcc: "ការកែកំហុស", qrTransparent: "ផ្ទៃខាងក្រោយថ្លា", qrPreviewAlt: "QR code ដែលបានបង្កើត",
  qrEmpty: "បំពេញទម្រង់ ហើយ QR code របស់អ្នកនឹងបង្ហាញនៅទីនេះ។",

  ipSub: "ផ្ទុកឡើងរូបភាព ហើយទទួលបាន prompt សម្រាប់ AI បង្កើតរូបភាព។", ipDropHint: "PNG, JPG ឬ WebP — រូបថតធំៗនឹងត្រូវបង្រួមដោយស្វ័យប្រវត្តិ",
  ipBadType: "សូមជ្រើសរើសរូបភាព PNG, JPG ឬ WebP។", ipStyle: "ប្រភេទ prompt", ipDetailed: "លម្អិត", ipMidjourney: "Midjourney", ipSd: "Stable Diffusion", ipShort: "ខ្លី",
  ipGenerate: "បង្កើត prompt", ipWorking: "កំពុងវិភាគរូបភាព…", ipDone: "Prompt រួចរាល់។", ipFree: "ឧបករណ៍ឥតគិតថ្លៃ — មិនប្រើ token ទេ។", ipPrompt: "Prompt", ipNegative: "Negative prompt", ipModel: "ម៉ូដែល",
  ipEmpty: "Prompt របស់អ្នកនឹងបង្ហាញនៅទីនេះ។", ipPreviewAlt: "រូបភាពដែលបានជ្រើស",

  vdLink: "តំណវីដេអូ ឬរូបភាព", vdFetch: "យកតំណទាញយក", vdFetching: "កំពុងស្វែងរក…", vdDirect: "ឯកសារផ្ទាល់",
  vdNote: "ទាញយកតែមាតិកាដែលអ្នកមានសិទ្ធិរក្សាទុកប៉ុណ្ណោះ។ មិនគាំទ្រ YouTube, Facebook, Instagram និង X ទេ។",
  vdStarted: "ការទាញយកបានចាប់ផ្តើម។", vdExpires: "តំណទាញយកផុតកំណត់ក្រោយ ៣០ នាទី — យកម្តងទៀតប្រសិនបើវាឈប់ដំណើរការ។",

  eaDropHint: "MP4, MOV, MKV, WebM, MP3, WAV, M4A…", eaFormat: "ទម្រង់លទ្ធផល", eaBitrate: "គុណភាព", eaStart: "ចាប់ផ្តើម (ស្រេចចិត្ត)", eaEnd: "បញ្ចប់ (ស្រេចចិត្ត)",
  eaRangeBad: "បញ្ចូលចន្លោះពេលត្រឹមត្រូវ ឧ. 0:30 ដល់ 1:45។", eaExport: "នាំចេញសម្លេង", eaWorking: "កំពុងបម្លែង…", eaDone: "បាននាំចេញសម្លេង។",
  eaServerNote: "បម្លែងនៅលើម៉ាស៊ីនបម្រើ (ឯកសារដល់ 4 MB)។", eaBrowserNote: "បម្លែងក្នុង browser របស់អ្នក — ឯកសារមិនត្រូវបានផ្ទុកឡើងទេ។",
  eaBigFile: "ឯកសារនេះធំជាង {mb} MB ដូច្នេះនឹងបម្លែងក្នុង browser ជា WAV។", eaWavOnly: "ឯកសារធំជាង {mb} MB បម្លែងក្នុង browser ហើយរក្សាទុកបានតែជា WAV ប៉ុណ្ណោះ។",

  srtSub: "សម្លេង ឬវីដេអូខ្មែរ → ចំណងជើងរងដែលកែបាន ជាមួយពេលវេលាពិតប្រាកដរៀងរាល់ពាក្យ។", srtDropHint: "MP3, WAV, M4A, MP4, WebM… (រហូតដល់ ៦០ នាទី)", srtLinkLabel: "…ឬបិទភ្ជាប់តំណ TikTok / Pinterest", srtLinkBtn: "ទាញយកពីតំណ", srtLinkFetching: "កំពុងទាញយក…", srtLinkBad: "សូមបញ្ចូលតំណពេញ ចាប់ផ្ដើមដោយ https://", srtLinkNoMedia: "រកមិនឃើញសម្លេង ឬវីដេអូនៅតំណនោះទេ។", srtLinkFail: "មិនអាចទាញយកតំណនោះបានទេ។ សូមព្យាយាមម្ដងទៀត។", srtLinkOk: "បានផ្ទុកតំណ។ ចុច Generate។",
  srtSettings: "ការកំណត់ចំណងជើងរង", srtMaxChars: "តួអក្សរក្នុងមួយបន្ទាត់", srtMaxLines: "បន្ទាត់ក្នុងមួយចំណងជើងរង", srtMaxDur: "រយៈពេលអតិបរមា (វិ)", srtMinDur: "រយៈពេលអប្បបរមា (វិ)", srtPause: "ញែកពេលផ្អាក (វិ)",
  srtGenerate: "បង្កើតចំណងជើងរង", srtWorking: "កំពុងដំណើរការ…", srtDone: "ចំណងជើងរង {n} រួចរាល់។", srtStageDecode: "កំពុងអានសម្លេង…", srtStageChunk: "កំពុងបម្លែងផ្នែកទី {i} ក្នុងចំណោម {n}…",
  srtStageCues: "កំពុងបង្កើតចំណងជើងរង…", srtStageDone: "រួចរាល់។", srtCues: "ចំណងជើងរង", srtWordLevel: "ពេលវេលារៀងរាល់ពាក្យ", srtSegLevel: "ពេលវេលាតាមឃ្លា (ភាពជាក់លាក់តិចជាង)",
  srtIssues: "ត្រូវពិនិត្យ", srtWarnings: "សូមពិនិត្យ៖", srtStart: "ម៉ោងចាប់ផ្តើម", srtEnd: "ម៉ោងបញ្ចប់", srtText: "អត្ថបទចំណងជើងរង", srtPlayCue: "ចាក់ចំណងជើងរងនេះ", srtSplit: "ញែក", srtMerge: "បញ្ចូលជាមួយបន្ទាប់",
  srtShift: "រុញទាំងអស់ (វិនាទី)", srtShiftBtn: "រុញទាំងអស់", srtFixOverlaps: "ដោះស្រាយការត្រួតគ្នា", srtRealign: "កំណត់ពេលអត្ថបទដែលបានកែឡើងវិញ", srtAligned: "អត្ថបទដែលបានកែត្រូវបានតម្រឹមទៅនឹងសម្លេង។",
  srtRebuild: "បង្កើតឡើងវិញ", srtRebuildTitle: "បង្កើតចំណងជើងរងឡើងវិញ?", srtRebuildMsg: "ការកែប្រែដោយដៃរបស់អ្នកនឹងត្រូវជំនួសដោយចំណងជើងរងថ្មីតាមការកំណត់ទាំងនេះ។", srtRebuilt: "បានបង្កើតចំណងជើងរងឡើងវិញ។",
  srtNoCues: "គ្មានចំណងជើងរងទៀតទេ។", srtBom: "បន្ថែម UTF-8 BOM (សម្រាប់កម្មវិធីចាក់ចាស់ៗ)", srtExport: "ទាញយក .srt", srtIssuesTitle: "ចំណងជើងរងខ្លះត្រូវការការយកចិត្តទុកដាក់",
  srtIssuesMsg: "ចំណងជើងរង {n} មានបញ្ហាពេលវេលា ឬអត្ថបទ។ នាំចេញទោះយ៉ាងណា?", srtExportAnyway: "នាំចេញទោះយ៉ាងណា",
  srtIssue_empty: "គ្មានអត្ថបទ", srtIssue_order: "ម៉ោងបញ្ចប់មុនម៉ោងចាប់ផ្តើម", srtIssue_short: "ខ្លីពេក", srtIssue_overlap: "ត្រួតនឹងចំណងជើងបន្ទាប់",

  ttsReady: "សម្លេងរួចរាល់។", ttsEmpty: "សូមវាយអត្ថបទខ្មែរជាមុនសិន។", ttsChars: "តួអក្សរ",

  csChooseFile: "សូមជ្រើសរើសឯកសារជាមុនសិន។",   csUnavailable: "CloudShare មិនទាន់ត្រូវបានរៀបចំលើម៉ាស៊ីនបម្រើនេះទេ (ខ្វះមូលដ្ឋានទិន្នន័យ CloudShare)។",
  settingsAppearance: "រូបរាង", settingsTheme: "ស្បែកអេក្រង់", settingsDark: "ងងឹត", settingsLight: "ភ្លឺ", settingsReduce: "កាត់បន្ថយចលនា", settingsReduceHint: "ចលនាតិចជាងមុន សមរម្យសម្រាប់ទូរស័ព្ទយឺត។",
  settingsAccount: "គណនី", settingsPlan: "Token និងការបង់ប្រាក់", settingsGemini: "Gemini API key", settingsGeminiHint: "ប្រើសម្រាប់ឧបករណ៍សម្លេងឥតគិតថ្លៃ និង AI។ រក្សាទុកដោយអ៊ីនគ្រីបក្នុងគណនីរបស់អ្នក ពេលចូលគណនី។",
  settingsData: "ទិន្នន័យលើឧបករណ៍នេះ", settingsDataHint: "កំណត់ភាសា ស្បែក និងចលនាឡើងវិញ។ គម្រោង និងគណនីរបស់អ្នកមិនប៉ះពាល់ទេ។", settingsReset: "កំណត់ឡើងវិញ", settingsDone: "បានកំណត់ឡើងវិញ។",
  settingsLogin: "សូមចូលគណនី ដើម្បីមើលគណនីរបស់អ្នក។", settingsRole: "តួនាទី", settingsTokens: "Token", settingsTopUp: "បញ្ចូល Token", settingsProfile: "កែប្រូហ្វាល់", settingsLogout: "ចាកចេញ", settingsLangHint: "ផ្លាស់ប្តូរទាំងគេហទំព័រ។",
  csHow: "របៀបប្រើ", csStep1: "ផ្ទុកឡើង", csStep1d: "ជ្រើសរើស ឬទម្លាក់ឯកសារ។", csStep2: "កំណត់ពេលផុតកំណត់", csStep2d: "តំណអាចឈប់ដំណើរការបន្ទាប់ពី ១ ម៉ោង ១ ថ្ងៃ ឬ ៧ ថ្ងៃ។", csStep3: "ចែករំលែកតំណ", csStep3d: "អ្នកមានតំណអាចទាញយកបាន។", csPriceNote: "ការផ្ទុកឡើងគិត {n} token ក្នុង ១ MB (បង្គត់ឡើង)។",
  csTitle: "Cloud Share", csSub: "ផ្ទុកឡើងឯកសារ ទទួលតំណ ហើយចែករំលែកគ្រប់ទីកន្លែង។", csDrop: "អូស & ទម្លាក់ឯកសារនៅទីនេះ", csOr: "ឬ", csBrowse: "ជ្រើសរើសឯកសារ",
  csExpires: "តំណផុតកំណត់", csNever: "មិនដែល", cs1h: "ក្នុង ១ ម៉ោង", cs1d: "ក្នុង ១ ថ្ងៃ", cs7d: "ក្នុង ៧ ថ្ងៃ", csMax: "ទំហំឯកសារអតិបរមា", csUpload: "ផ្ទុកឡើង",
  csUploading: "កំពុងផ្ទុកឡើង…", csCancel: "បោះបង់", csDone: "ផ្ទុកឡើងរួចរាល់", csYourLink: "តំណចែករំលែករបស់អ្នក", csCopy: "ចម្លងតំណ", csOpen: "បើកតំណ", csAnother: "ផ្ទុកឡើងឯកសារផ្សេងទៀត",
  csFailed: "ផ្ទុកឡើងបរាជ័យ", csRetry: "ព្យាយាមម្តងទៀត", csRemove: "លុបឯកសារ",
  csTooLarge: "ឯកសារធំពេកសម្រាប់ម៉ាស៊ីនបម្រើនេះ (កំណត់ ≈ 4 MB លើ Vercel)។", csBadResponse: "ម៉ាស៊ីនបម្រើឆ្លើយតបមិនត្រឹមត្រូវ។",

  err_UNKNOWN: "មានបញ្ហា សូមសាកល្បងម្តងទៀត។", err_NETWORK: "មិនអាចតភ្ជាប់ម៉ាស៊ីនបម្រើបានទេ សូមពិនិត្យអ៊ីនធឺណិត ហើយសាកម្តងទៀត។",
  err_TOO_LARGE: "ឯកសារធំពេកសម្រាប់ម៉ាស៊ីនបម្រើ (អតិបរមា ≈ 4 MB)។", err_RATE_LIMITED: "សំណើច្រើនពេក សូមរង់ចាំពីរបីនាទី។",
  err_LOGIN_REQUIRED: "សូមចូលគណនីដើម្បីប្រើ key របស់ម៉ាស៊ីនបម្រើ ឬបន្ថែម Gemini API key ផ្ទាល់ខ្លួន។", err_NO_SERVER_KEY: "ម៉ាស៊ីនបម្រើគ្មាន Gemini key ទេ សូមបន្ថែម key ផ្ទាល់ខ្លួន។",
  err_NO_API_KEY: "សូមបន្ថែម Gemini API key របស់អ្នក។", err_INVALID_API_KEY_FORMAT: "API key នេះមើលទៅមិនត្រឹមត្រូវ។", err_INVALID_API_KEY: "Google បដិសេធ API key នេះ សូមពិនិត្យ ហើយសាកម្តងទៀត។",
  err_KEY_FORBIDDEN: "API key នេះមិនត្រូវបានអនុញ្ញាតឱ្យប្រើម៉ូដែលនោះទេ។", err_QUOTA_EXCEEDED: "កូតា Gemini របស់ key នេះអស់ហើយ សូមសាកពេលក្រោយ ឬប្រើ key ផ្សេង។",
  err_MODEL_NOT_FOUND: "ម៉ូដែល Gemini មិនមានសម្រាប់ key នេះទេ។", err_GEMINI_UNAVAILABLE: "Gemini កំពុងរវល់ សូមសាកម្តងទៀតបន្តិចក្រោយ។",
  err_EMPTY_TRANSCRIPT: "រកមិនឃើញសំឡេងនិយាយក្នុងសម្លេងនេះទេ។", err_NO_FILE: "សូមជ្រើសរើសឯកសារ។", err_CHUNK_TOO_LONG: "ផ្នែកសម្លេងវែងពេក។",
  err_DECODE_FAILED: "មិនអាចអានឯកសារនេះបានទេ សូមសាក MP3, WAV, M4A, OGG, MP4 ឬ WebM។", err_TOO_LONG: "ការថតវែងពេកសម្រាប់ browser។",
  err_NO_AUDIO_API: "browser នេះមិនអាចដំណើរការសម្លេងបានទេ។", err_EMPTY_AUDIO: "សម្លេងទទេ។", err_EMPTY_RANGE: "ចន្លោះពេលដែលបានជ្រើសទទេ។",
  err_UNSUPPORTED_IMAGE: "សូមប្រើរូបភាព PNG, JPG ឬ WebP។", err_IMAGE_UNREADABLE: "មិនអាចអានរូបភាពនេះបានទេ។",
  err_INVALID_QR_DATA: "សូមពិនិត្យមាតិកា QR។", err_LOW_CONTRAST: "ពណ៌ QR ស្រដៀងគ្នាពេក — វានឹងមិនអាចស្កេនបាន។", err_QR_TOO_LARGE: "មាតិកានោះវែងពេកសម្រាប់ QR code។",
  err_INVALID_URL: "សូមបិទភ្ជាប់តំណត្រឹមត្រូវ។", err_BLOCKED_URL: "អាសយដ្ឋាននោះមិនត្រូវបានអនុញ្ញាតទេ។", err_UNSUPPORTED_SITE: "មិនគាំទ្រគេហទំព័រនេះទេ។ សូមប្រើ TikTok, Pinterest ឬតំណឯកសារផ្ទាល់។",
  err_UNSUPPORTED_LINK: "តំណនោះមិនមែនជាឯកសារវីដេអូ សម្លេង ឬរូបភាពផ្ទាល់ទេ។", err_VIDEO_NOT_FOUND: "រកមិនឃើញឯកសារដែលអាចទាញយកបាននៅតំណនោះទេ។",
  err_PROVIDER_UNAVAILABLE: "គេហទំព័រប្រភពមិនឆ្លើយតបទេ សូមសាកពេលក្រោយ។", err_TOKEN_EXPIRED: "តំណទាញយកនេះផុតកំណត់ សូមយកតំណម្តងទៀត។", err_INVALID_TOKEN: "តំណទាញយកមិនត្រឹមត្រូវ។",
  err_UNSUPPORTED_MEDIA: "ឯកសារនោះមិនមែនជាឯកសារសម្លេង ឬវីដេអូដែលគាំទ្រទេ។", err_CONVERT_FAILED: "មិនអាចបម្លែងឯកសារនោះបានទេ វាអាចខូច ឬគ្មានសម្លេង។",
  err_CONVERT_TIMEOUT: "ការបម្លែងយូរពេក សូមសាកឯកសារខ្លីជាងនេះ។", err_FFMPEG_MISSING: "ការបម្លែងសម្លេងមិនមាននៅលើម៉ាស៊ីនបម្រើនេះទេ។",
  err_TTS_UNAVAILABLE: "សេវាសម្លេងមិនអាចទាក់ទងបាននៅពេលនេះ សូមសាកម្តងទៀត។", err_EMPTY_TEXT: "សូមវាយអត្ថបទ។", err_TEXT_TOO_LONG: "អត្ថបទវែងពេក (អតិបរមា ៣០០០ តួអក្សរ)។",
  err_NO_DATABASE: "មុខងារនេះត្រូវការមូលដ្ឋានទិន្នន័យ ដែលមិនទាន់កំណត់។", err_DATABASE_UNAVAILABLE: "មិនអាចទាក់ទងមូលដ្ឋានទិន្នន័យបានទេ សូមសាកម្តងទៀតបន្តិចក្រោយ។",
};
