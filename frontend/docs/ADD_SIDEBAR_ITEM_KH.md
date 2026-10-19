# របៀបបន្ថែមមុខទំព័រនៅ Sidebar

Sidebar ទាំងមូលត្រូវបានបង្កើតចេញពីទិន្នន័យនៅក្នុងឯកសារ៖

```
src/data/sidebarItems.js
```

Sidebar មិនត្រូវបានសរសេរផ្ទាល់នៅក្នុង JSX ទេ ប៉ុន្តែវាត្រូវបានបង្កើតដោយស្វ័យប្រវត្តិដោយប្រើ `.map()` ពីទិន្នន័យក្នុងឯកសារនេះ។

## រចនាសម្ព័ន្ធនៃមុខទំព័រធម្មតា (គ្មាន Dropdown)

```js
{
  labelKey: "example",
  icon: "ri-star-line",
  path: "/example",
}
```

- `labelKey` — គ្រាប់ចុចដែលភ្ជាប់ទៅនឹងអត្ថបទបកប្រែនៅក្នុង `LanguageContext.jsx`
- `icon` — ឈ្មោះ class របស់ Remix Icon
- `path` — ផ្លូវ (route) ដែល Router ត្រូវនាំទៅ

## រចនាសម្ព័ន្ធនៃមុខទំព័រដែលមាន Dropdown

ប្រសិនបើអ្នកចង់បង្កើតមុខទំព័រដែលមាន Submenu (ដូច "Projects")៖

```js
{
  labelKey: "projects",
  icon: "ri-folder-line",
  path: "/projects",
  children: [
    { labelKey: "allProjects", path: "/projects" },
    { labelKey: "activeProjects", path: "/projects/active" },
  ],
}
```

នៅពេលដែល object មាន `children` លក្ខណៈសម្បត្តិ (property) Sidebar នឹងបង្ហាញវាជា Dropdown ដោយស្វ័យប្រវត្តិ។

## របៀបប្រើ Remix Icon Class

Remix Icon ប្រើ CSS class ដូចជា៖

```
ri-home-line
ri-dashboard-line
ri-folder-line
ri-settings-3-line
ri-star-line
```

អ្នកអាចរកមើល icon ផ្សេងទៀតបាននៅគេហទំព័រ https://remixicon.com — ចុចលើ icon ណាមួយ ហើយចម្លងឈ្មោះ class របស់វា។

## ជំហានចុងក្រោយ

កុំភ្លេចបន្ថែម `labelKey` របស់អ្នកទៅក្នុង `translations` (ទាំងអង់គ្លេស និងខ្មែរ) នៅក្នុងឯកសារ `src/context/LanguageContext.jsx` មិនដូច្នោះទេ អត្ថបទនឹងបង្ហាញជាឈ្មោះ key ដើម។
