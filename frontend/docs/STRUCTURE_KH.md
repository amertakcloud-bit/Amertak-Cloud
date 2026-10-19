# ការពន្យល់រចនាសម្ព័ន្ធថតឯកសារ

```
react-dashboard-starter/
├── public/                    ឯកសារស្ថិតភាព (static) ដូចជារូបភាព
├── docs/                      ឯកសារណែនាំជាភាសាខ្មែរ
├── src/
│   ├── components/            Component តូចៗដែលប្រើឡើងវិញបាន
│   │   ├── Header.jsx
│   │   ├── Sidebar.jsx
│   │   └── SidebarItem.jsx
│   ├── layouts/
│   │   └── MainLayout.jsx     ប្លង់រួមសម្រាប់គ្រប់ទំព័រ
│   ├── pages/                 ទំព័រនីមួយៗនៃកម្មវិធី
│   │   ├── Home.jsx
│   │   ├── Dashboard.jsx
│   │   ├── Projects.jsx
│   │   ├── Settings.jsx
│   │   └── NotFound.jsx
│   ├── data/
│   │   └── sidebarItems.js    ទិន្នន័យសម្រាប់ Sidebar
│   ├── context/
│   │   └── LanguageContext.jsx  ភាសា EN / KM
│   ├── styles/                ឯកសារ CSS ទាំងអស់
│   ├── App.jsx                កំណត់ Route ទាំងអស់
│   └── main.jsx                ចំណុចចាប់ផ្តើមកម្មវិធី
├── index.html
├── package.json
├── vite.config.js
└── README.md
```

## ការពន្យល់ជាក់លាក់

### `src/components/`

មានផ្ទុក Component តូចៗដែលប្រើឡើងវិញបាននៅច្រើនកន្លែង។ ឧទាហរណ៍ `Header.jsx` ត្រូវបានប្រើនៅគ្រប់ទំព័រតាមរយៈ `MainLayout.jsx`។

### `src/layouts/MainLayout.jsx`

នេះជា "ប្រអប់" ដែលរុំព័ទ្ធជុំវិញគ្រប់ទំព័រទាំងអស់។ វាផ្ទុក Sidebar, Header, និង `<Outlet />` (ជាកន្លែងដែលទំព័រនីមួយៗលេចចេញមក)។

### `src/pages/`

ទំព័រនីមួយៗគឺជា Component មួយ ដែលតំណាងឱ្យខ្លឹមសារនៃផ្លូវ (route) នីមួយៗ។ ទំព័រទាំងនេះមិនចាំបាច់សរសេរ Sidebar ឬ Header ម្តងទៀតទេ ព្រោះ `MainLayout.jsx` ធ្វើវារួចហើយ។

### `src/data/sidebarItems.js`

ជាកន្លែងផ្ទុកទិន្នន័យសម្រាប់ Sidebar ទាំងអស់ (ឈ្មោះ, icon, path)។ ការញែកទិន្នន័យចេញដាច់ដោយឡែក ធ្វើឱ្យការបន្ថែម ឬកែប្រែមុខទំព័រធ្វើទៅបានយ៉ាងងាយ។

### `src/context/LanguageContext.jsx`

គ្រប់គ្រងភាសាទាំងមូលនៃកម្មវិធី (អង់គ្លេស / ខ្មែរ) ដោយប្រើ React Context។ គ្រប់ Component អាចហៅប្រើ `useLanguage()` ដើម្បីទទួលបានអត្ថបទត្រឹមត្រូវតាមភាសាដែលបានជ្រើសរើស។

### `src/styles/`

ឯកសារ CSS ត្រូវបានញែកជាផ្នែកៗ ដើម្បីងាយស្រួលរកមើល និងកែប្រែ។ សូមមើល `docs/STYLING_KH.md` សម្រាប់ព័ត៌មានលម្អិត។

### `src/App.jsx`

កំណត់ Route ទាំងអស់ដោយប្រើ React Router DOM។ នេះជាកន្លែងតែមួយគត់ដែលអ្នកត្រូវបន្ថែម `<Route>` ថ្មីនៅពេលបង្កើតទំព័រថ្មី។

### `src/main.jsx`

ជាចំណុចចាប់ផ្តើមដំបូងបំផុតនៃកម្មវិធី។ វា import CSS ទាំងអស់ និងព័ទ្ធកម្មវិធីទាំងមូលដោយ `BrowserRouter` និង `LanguageProvider`។
