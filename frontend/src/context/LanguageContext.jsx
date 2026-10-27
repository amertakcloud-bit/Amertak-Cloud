import { createContext, useContext, useState, useEffect } from "react";
import { en as toolsEn, km as toolsKm } from "../i18n/toolsText";
import { en as moreEn, km as moreKm } from "../i18n/moreText";
import { en as homeEn, km as homeKm } from "../i18n/homeText";

// Language
// All the text strings the app uses, in English and Khmer.
// Add more keys here whenever you add new UI text.
const translations = {
  en: {
    home: "Home",
    tools: "Tools",
    getStart: "Get Start",
    getStartTitle: "Services & Tools",
    getStartSub: "Free, paid online tools & services.",
    dashboard: "Dashboard",
    adminDashboard: "Admin Dashboard",
    users: "Users",
    promoCodes: "Promo Codes",
    payments: "Payments",
    auditLog: "Audit log",
    projects: "Projects",
    allProjects: "All Projects",
    activeProjects: "Active Projects",
    archivedProjects: "Archived Projects",
    settings: "Settings",
    notFound: "Page Not Found",
    brandTitle: "Amertak Cloud",
    getStartDecribtion: "Wellcome to Amertak Cloud. Enjoy our services and tools with free and sale best price. Click Get Start to explore more.",
    viewPlans: "View Plans",  
    notFoundMessage: "The page you are looking for does not exist.",
    goHome: "Go back home",
    welcome: "Welcome to",
    homeSubtitle: "This is your starter dashboard template.",
    dashboardSubtitle: "An overview of your project activity.",
    projectsSubtitle: "Manage and browse your projects.",
    settingsSubtitle: "Update your preferences.",
    totalProjects: "Total Projects",
    activeUsers: "Active Users",
    tasksDone: "Tasks Done",
    recentActivity: "Recent Activity",
    profile: "Profile",
    language: "Language",
    theme: "Theme",

    // Authentication
    account: "Account",
    login: "Login",
    register: "Register",
    logout: "Log out",
    name: "Name",
    email: "Email",
    password: "Password",
    confirmPassword: "Confirm Password",
    loggingIn: "Logging in…",
    registering: "Creating account…",
    googleLogin: "Login With Google",
    telegramLogin: "Login With Telegram",
    forgotPassword: "Forgot password?",
    forgotPasswordTitle: "Forgot Password",
    forgotPasswordSubtitle: "Enter your account email and we'll send you reset instructions.",
    sendReset: "Send reset instructions",
    sending: "Sending…",
    backToLogin: "Back to login",
    noAccount: "Don't have an account?",
    haveAccount: "Already have an account?",
    registerNow: "Register now!",
    loginNow: "Login now!",
    passwordsDoNotMatch: "Passwords do not match.",
    acceptTermsFirst: "Please accept the terms of service first.",
    iReadAndAgree: "I read and agree to",
    termsOfService: "terms of service",
    profileSubtitle: "Your account information and preferences.",
    profileSaved: "Profile updated successfully.",
    role: "Role",
    memberSince: "Member since",
    editProfile: "Edit Profile",
    avatarUrl: "Avatar URL",
    saving: "Saving…",
    saveChanges: "Save Changes",
    welcomeBack: "Welcome back",

    // Payment & tokens
    tokens: "Tokens",
    tokenBalance: "Balance",
    payLoginRequired: "Please log in to buy a plan.",
    payClaiming: "Adding tokens to your account…",
    payClaimFailed: "Could not add tokens yet. Please try again.",
    retry: "Retry",

    // Custom plan
    customPlan: "Custom",
    customTokensHint: "Enter token amount",
    customRateInfo: "300 tokens = $1.00",
    customTokenInfo: "Max Token: 5000",
    customMinPrice: "Minimum $0.10 (30 tokens)",
    buyCustom: "Buy",

    // Plans / Plants page
    plantTitle: "Plans",
    plantSub: "Choose a plan that fits your needs.",
    buyPay: "Buy",
    subscribe: "Subscribe",
    subscribed: "Subscribed",
    choosePlans: "Choose Plans",
    maxToken: "Max Token",
    token: "Token",
    freeToken: "Free Token",
    tokenAdded: "(Added to Max Token)",

    // KHQR payment
    payTitle: "Pay with KHQR",
    paySubtitle: "Enter the amount to create a QR code",
    payAmount: "Amount",
    payCreate: "Create QR",
    payCreating: "Creating…",
    payEnterAmount: "You are Subscribed!",
    payClose: "Close",
    close: "Close",
    payExpiresIn: "Expires in",
    payQrFallback: "Cannot display the QR image. Please use the button below.",
    payOpenBank: "Open in banking app",
    payUnpaid: "Waiting for scan…",
    payScanned: "Scanned! Please confirm the payment in your banking app",
    payPaid: "Payment successful",
    payExpired: "QR expired",
    payPaidMsg: "Thank you! Your order has been confirmed.",
    payExpiredMsg: "Please create a new QR code to continue the payment.",
    payAgain: "Start again",
    payErrorGeneric: "Something went wrong. Please try again.",
    errInvalidRequest: "The amount is invalid",
    errTooManyRequests: "Too many requests. Please wait a moment and try again.",
    errPaymentProviderTimeout: "The payment system is responding slowly. Please try again.",
    errPaymentProviderMaintenance: "The payment system is under maintenance. Please try again later.",

    // Describe Context
    dCloudStorage: "A storage tools keep data images, any files and generate link to share to more social media to download.",
    dVideoDownloader: "Download videos, images and audio from Tiktok and Pinterest with no watermark.",
    dExportAudio: "Export audio from video support all video formates.",
    CloudStorage: "Cloud Storage",
    VideoDownloader: "Video Downloader",
    ExportAudio: "Export Audio",
    Srt: "Subtitles (SRT)",
    TextToSpeech: "Text to Speech",
    GenerateQr: "QR Code Generator",
    TopUp: "Top Up",
    viewPlants: "Plans",
  },
  km: {
    home: "ទំព័រដើម",
    tools: "ឧបករណ៍",
    getStart: "ចាប់ផ្តើម",
    getStartTitle: "Services & Tools",
    getStartSub: "Free, Paid មុខងារអនឡាញ និង Services",
    dashboard: "ផ្ទាំងគ្រប់គ្រង",
    adminDashboard: "ផ្ទាំងគ្រប់គ្រងរដ្ឋបាល",
    users: "អ្នកប្រើប្រាស់",
    promoCodes: "ប្រូម៉ូកូដ",
    payments: "ការបង់ប្រាក់",
    auditLog: "កំណត់ត្រាសកម្មភាព",
    projects: "គម្រោង",
    allProjects: "គម្រោងទាំងអស់",
    activeProjects: "គម្រោងកំពុងដំណើរការ",
    archivedProjects: "គម្រោងបានទុកក្នុងបណ្ណសារ",
    settings: "ការកំណត់",
    brandTitle: "Amertak Cloud",
    getStartDecribtion: "សូមស្វាគមន៍មកកាន់ អមតៈ ក្លោត, រីករាយជាមួយសេវាកម្មរបស់យើង និង ឧបករណ៍ឥតគិតថ្លៃ និងលក់ក្នងតម្លៃល្អ។ ចុច ចាច់ផ្តើម ដើម្បីស្វែងរក។",
    viewPlans: "មើលគម្រោង",  
    notFound: "រកមិនឃើញទំព័រ",
    notFoundMessage: "ទំព័រដែលអ្នកកំពុងស្វែងរកមិនមានទេ។",
    goHome: "ត្រលប់ទៅទំព័រដើម",
    welcome: "សូមស្វាគមន៍មកកាន់",
    homeSubtitle: "នេះជាគំរូផ្ទាំងគ្រប់គ្រងចាប់ផ្តើមរបស់អ្នក។",
    dashboardSubtitle: "ទិដ្ឋភាពទូទៅនៃសកម្មភាពគម្រោងរបស់អ្នក។",
    projectsSubtitle: "គ្រប់គ្រង និងមើលគម្រោងរបស់អ្នក។",
    settingsSubtitle: "កែប្រែចំណូលចិត្តរបស់អ្នក។",
    totalProjects: "គម្រោងសរុប",
    activeUsers: "អ្នកប្រើប្រាស់សកម្ម",
    tasksDone: "ភារកិច្ចបានបញ្ចប់",
    recentActivity: "សកម្មភាពថ្មីៗ",
    profile: "ប្រវត្តិរូប",
    language: "ភាសា",
    theme: "រូបរាង",

    // Authentication
    account: "គណនី",
    login: "ចូល",
    register: "ចុះឈ្មោះ",
    logout: "ចាកចេញ",
    name: "ឈ្មោះ",
    email: "អ៊ីមែល",
    password: "ពាក្យសម្ងាត់",
    confirmPassword: "បញ្ជាក់ពាក្យសម្ងាត់",
    loggingIn: "កំពុងចូល…",
    registering: "កំពុងបង្កើតគណនី…",
    googleLogin: "ចូលជាមួយ Google",
    telegramLogin: "ចូលជាមួយតេលេក្រាម",
    forgotPassword: "ភ្លេចពាក្យសម្ងាត់?",
    forgotPasswordTitle: "ភ្លេចពាក្យសម្ងាត់",
    forgotPasswordSubtitle: "បញ្ចូលអ៊ីមែលគណនីរបស់អ្នក ហើយយើងនឹងផ្ញើការណែនាំកំណត់ឡើងវិញ។",
    sendReset: "ផ្ញើការណែនាំ",
    sending: "កំពុងផ្ញើ…",
    backToLogin: "ត្រលប់ទៅទំព័រចូល",
    noAccount: "មិនទាន់មានគណនី?",
    haveAccount: "មានគណនីរួចហើយ?",
    registerNow: "ចុះឈ្មោះឥឡូវនេះ!",
    loginNow: "ចូលឥឡូវនេះ!",
    passwordsDoNotMatch: "ពាក្យសម្ងាត់មិនដូចគ្នាទេ។",
    acceptTermsFirst: "សូមទទួលយកលក្ខខណ្ឌនៃសេវាកម្មជាមុនសិន។",
    iReadAndAgree: "ខ្ញុំអាន និង យល់ព្រម:",
    termsOfService: "លក្ខខណ្ឌនៃសេវាកម្ម",
    profileSubtitle: "ព័ត៌មានគណនី និងចំណូលចិត្តរបស់អ្នក។",
    profileSaved: "បានកែប្រែប្រវត្តិរូបជោគជ័យ។",
    role: "តួនាទី",
    memberSince: "សមាជិកតាំងពី",
    editProfile: "កែប្រែប្រវត្តិរូប",
    avatarUrl: "តំណរូបភាព",
    saving: "កំពុងរក្សាទុក…",
    saveChanges: "រក្សាទុកការកែប្រែ",
    welcomeBack: "សូមស្វាគមន៍មកវិញ",

    // Payment & tokens
    tokens: "ថូខេន",
    tokenBalance: "សមតុល្យ",
    payLoginRequired: "សូមចូលគណនីសិនដើម្បីទិញផែនការ។",
    payClaiming: "កំពុងបន្ថែមថូខេនទៅគណនីរបស់អ្នក…",
    payClaimFailed: "មិនទាន់អាចបន្ថែមថូខេនបានទេ សូមសាកម្តងទៀត។",
    retry: "សាកឡើងវិញ",

    // Custom plan
    customPlan: "ផ្ទាល់ខ្លួន",
    customTokensHint: "បញ្ចូលចំនួនថូខេន",
    customRateInfo: "300 ថូខេន = $1.00",
    customTokenInfo: "ថូខេនអប្បបរិមាៈ ៥០០០",
    customMinPrice: "អតិប្បរិមា $0.10 (30 ថូខេន)",
    customMaxToken: "អប្បបរិមា $16.67 (5000 ថូខេន)",
    buyCustom: "ទិញ",

    // Plans / Plants page
    plantTitle: "ផែនការ",
    plantSub: "ជ្រើសរើសផែនការដែលសមស្របតាមតម្រូវការរបស់អ្នក។",
    buyPay: "ទិញ",
    subscribe: "ជាវ",
    subscribed: "បានជាវ",
    choosePlans: "ជ្រើសរើសផែនការ",
    maxToken: "ថូខេនសរុប",
    token: "ថូខេន",
    freeToken: "ថូខេនឥតគិតថ្លៃ",
    tokenAdded: "(បានបញ្ចូលទៅថូខេនសរុប)",

    // KHQR payment
    payTitle: "ទូទាត់តាម KHQR",
    paySubtitle: "បញ្ចូលចំនួនទឹកប្រាក់ ដើម្បីបង្កើត QR",
    payAmount: "ចំនួនទឹកប្រាក់",
    payCreate: "បង្កើត QR",
    payCreating: "កំពុងបង្កើត…",
    payEnterAmount: "អ្នកបាន Subscribe រួចហើយ!",
    payClose: "បិទ",
    close: "បោះបង់",
    payExpiresIn: "ផុតកំណត់ក្នុង",
    payQrFallback: "មិនអាចបង្ហាញរូប QR បានទេ សូមប្រើប៊ូតុងខាងក្រោម",
    payOpenBank: "បើកក្នុងកម្មវិធីធនាគារ",
    payUnpaid: "កំពុងរង់ចាំការស្កេន…",
    payScanned: "បានស្កេនហើយ! សូមបញ្ជាក់ការទូទាត់ក្នុងកម្មវិធីធនាគារ",
    payPaid: "ទូទាត់ជោគជ័យ",
    payExpired: "QR ផុតកំណត់",
    payPaidMsg: "អរគុណ! ការបញ្ជាទិញរបស់អ្នកត្រូវបានបញ្ជាក់។",
    payExpiredMsg: "សូមបង្កើត QR ថ្មី ដើម្បីបន្តការទូទាត់។",
    payAgain: "ចាប់ផ្តើមម្តងទៀត",
    payErrorGeneric: "មានបញ្ហា សូមសាកម្តងទៀត",
    errInvalidRequest: "ចំនួនទឹកប្រាក់មិនត្រឹមត្រូវ",
    errTooManyRequests: "សំណើច្រើនពេក សូមរង់ចាំបន្តិចហើយសាកម្តងទៀត",
    errPaymentProviderTimeout: "ប្រព័ន្ធទូទាត់ឆ្លើយតបយឺត សូមសាកម្តងទៀត",
    errPaymentProviderMaintenance: "ប្រព័ន្ធទូទាត់កំពុងថែទាំ សូមសាកម្តងទៀតពេលក្រោយ",

    // Tools Title
    CloudStorage: "Cloud Storage",
    VideoDownloader: "ទាញយកវីដេអូ",
    ExportAudio: "បម្លែងវីដេអូទៅសម្លេង",
    Srt: "បង្កើត Caption",
    TextToSpeech: "អក្សរទៅសម្លេង",
    GenerateQr: "បង្កើត Qrcode",
    // Describe Context
    dCloudStorage: "ឧបករណ៏ផ្ទុកទិន្ន័យ រូបភាព និងហ្វាល់ផ្សេងៗ ហើយបង្កើតលីងដើម្បីចែករំលែកទៅ Social Media ផ្សេងៗដើម្បីទាញយក។",
    dVideoDownloader: "ទាញយកវីដេអូ រូបភាព និងសម្លេង ពី Tiktok និង Pinterest ដោយមិនជាប់ watermask.",
    dExportAudio: "Export audio from video support all video formates.",
    TopUp: "បញ្ចូលទឹកប្រាក់",
    viewPlants: "ផែនការ",
  },
};

// Tool pages / errors live in i18n/toolsText.js. Existing keys win only when not redefined there,
// so shared keys (e.g. dSrt, dTts, dExportAudio) get the improved wording.
translations.en = { ...translations.en, ...toolsEn };
translations.km = { ...translations.km, ...toolsKm };
translations.en = { ...translations.en, ...moreEn };
translations.km = { ...translations.km, ...moreKm };
translations.en = { ...translations.en, ...homeEn };
translations.km = { ...translations.km, ...homeKm };

const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
  // Load saved language from localStorage, default to English
  const [language, setLanguage] = useState(() => {
    try {
      return localStorage.getItem("language") || "en";
    } catch {
      return "en";
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem("language", language);
    } catch {
      // localStorage not available, ignore
    }
  }, [language]);

  function toggleLanguage() {
    setLanguage((prev) => (prev === "en" ? "km" : "en"));
  }

  // t() looks up a translation string by key
  // Optional {name} placeholders: t("srtDone", { n: 5 }). Falls back to English, then the key.
  function t(key, vars) {
    let text = translations[language]?.[key] ?? translations.en?.[key] ?? key;
    if (vars) text = text.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
    return text;
  }

  const value = { language, setLanguage, toggleLanguage, t };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

// Custom hook so components can do: const { t } = useLanguage();
export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used inside a LanguageProvider");
  }
  return context;
}
