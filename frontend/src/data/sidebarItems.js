// Sidebar
// Central list of sidebar navigation items.
// Each item can optionally have "children" to become a dropdown/submenu.
// labelKey refers to a key inside LanguageContext.jsx translations.

const sidebarItems = [
  {
    labelKey: "home",
    icon: "ri-home-line",
    path: "/",
  },
  {
    labelKey: "getStart",
    icon: "ri-flashlight-fill",
    path: "/getstart"
  },
  {
    labelKey: "dashboard",
    icon: "ri-dashboard-line",
    path: "/dashboard",
  },
  {
    labelKey: "tools",
    icon: "ri-settings-6-line",
    path: "/tools",
    children: [
      { labelKey: "Clouds", icon: "ri-cloud-line", path: "/tools/cloud" },
      { labelKey: "VideoDownloader", icon: "ri-download-line", path: "/tools/downloader" },
      { labelKey: "ExportAudio", icon: "ri-voiceprint-line", path: "/tools/export-audio" },
      { labelKey: "VideoEditor", icon: "ri-movie-2-line", path: "/tools/video-editor" },
      { labelKey: "Srt", icon: "ri-closed-captioning-line", path: "/tools/srt" },
      { labelKey: "ImageToPrompt", icon: "ri-image-ai-line", path: "/tools/image-prompt" },
      { labelKey: "TextToSpeech", icon: "ri-text-to-speech-line", path: "/tools/tts" },
      { labelKey: "GenerateQr", icon: "ri-qr-code-line", path: "/tools/qr" },
    ],
  },
  {
    labelKey: "plantTitle",
    icon: "ri-stack-line",
    path: "/plans",
  },
  {
    labelKey: "account",
    icon: "ri-user-3-line",
    // Actual target is resolved in Sidebar.jsx:
    // signed in → /profile, guest → /login
    path: "/login",
  },
  {
    labelKey: "settings",
    icon: "ri-settings-3-line",
    path: "/settings",
  },
];

export default sidebarItems;
