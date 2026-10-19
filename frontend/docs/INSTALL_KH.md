# ការដំឡើង និងដំណើរការគម្រោង

## តើ Vite ជាអ្វី?

Vite (អានថា "vit") គឺជាឧបករណ៍សម្រាប់បង្កើត និងដំណើរការគម្រោង Web ដោយល្បឿនលឿន។ វាជួយឱ្យកូដរបស់អ្នកផ្ទុក (load) លឿន ពេលអ្នកកំពុងអភិវឌ្ឍគម្រោង។

## តើ React ជាអ្វី?

React គឺជា library ភាសា JavaScript សម្រាប់បង្កើត User Interface (UI)។ វាអនុញ្ញាតឱ្យអ្នកបង្កើត Component តូចៗ (ដូចជា Header, Sidebar) រួចផ្សំបញ្ចូលគ្នាឱ្យទៅជាទំព័រពេញលេញ។

## ជំហានទី ១៖ ដំឡើង Node.js

មុននឹងប្រើគម្រោងនេះ អ្នកត្រូវការ Node.js ជាមុនសិន។

1. ចូលទៅកាន់គេហទំព័រ https://nodejs.org
2. ទាញយក (Download) កំណែ LTS (Long Term Support)
3. ដំឡើងវាដូចកម្មវិធីធម្មតា
4. បើក Terminal (ឬ Command Prompt) ហើយវាយ៖

```bash
node -v
npm -v
```

ប្រសិនបើលេខកំណែបង្ហាញឡើង មានន័យថាការដំឡើងបានជោគជ័យ។

## ជំហានទី ២៖ ដំឡើង Dependencies

បើក Terminal នៅក្នុងថតគម្រោង (folder) នេះ ហើយវាយ៖

```bash
npm install
```

ពាក្យបញ្ជានេះនឹងទាញយក library ទាំងអស់ដែលគម្រោងត្រូវការ (React, React Router, Remix Icon ជាដើម) ដាក់ចូលទៅក្នុងថត `node_modules`។

## ជំហានទី ៣៖ ដំណើរការគម្រោង (Development)

```bash
npm run dev
```

Terminal នឹងបង្ហាញ URL មួយ (ជាធម្មតាគឺ `http://localhost:5173`)។ ចម្លង URL នេះ ហើយបើកនៅក្នុង Browser ដើម្បីមើលគម្រោង។

## ជំហានទី ៤៖ បញ្ឈប់ Server

នៅក្នុង Terminal ចុច `Ctrl + C` ដើម្បីបញ្ឈប់ server។

## ការបង្កើត Production Build

នៅពេលអ្នករួចរាល់ ហើយចង់ដាក់គម្រោងឡើង Host (ដូចជា Vercel, GitHub Pages, Render)៖

```bash
npm run build
```

ពាក្យបញ្ជានេះនឹងបង្កើតថតឯកសារ `dist/` ដែលមានឯកសារសុទ្ធសាធ (HTML, CSS, JS) ដែលត្រៀមរួចសម្រាប់ដាក់លើ Server។

## ការមើលសាកល្បង Production Build

```bash
npm run preview
```

ពាក្យបញ្ជានេះនឹងបើក server មួយបណ្ដោះអាសន្ន ដើម្បីអ្នកអាចមើលឯកសារនៅក្នុងថត `dist/` ថាដំណើរការត្រឹមត្រូវដែរឬទេ មុននឹងដាក់ដំឡើងជាផ្លូវការ។
