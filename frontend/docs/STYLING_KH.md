# របៀបកែប្រែរូបរាង (Styling)

ឯកសារ CSS ទាំងអស់ស្ថិតនៅក្នុងថត៖

```
src/styles/
```

## ថតឯកសារ CSS នីមួយៗ

| ឯកសារ | មាតិកា |
|---|---|
| `variables.css` | ពណ៌ទាំងអស់ (Dark / Light theme) |
| `global.css` | Reset, Font, Typography ទូទៅ |
| `layout.css` | ប្លង់ទូទៅនៃកម្មវិធី, Card, Button |
| `sidebar.css` | រូបរាង Sidebar |
| `header.css` | រូបរាង Header |
| `pages.css` | រូបរាងជាក់លាក់សម្រាប់ទំព័រនីមួយៗ |

## របៀបប្ដូរពណ៌ Background

បើកឯកសារ `src/styles/variables.css` រកមើលផ្នែក `[data-theme="dark"]`៖

```css
[data-theme="dark"] {
  --bg: #0b0b10;
  --surface: #13131c;
}
```

ផ្លាស់ប្តូរតម្លៃ `--bg` ទៅជាលេខកូដពណ៌ផ្សេង។

## របៀបប្ដូរពណ៌ស្វាយ (Purple Accent)

នៅក្នុងឯកសារដដែល រកមើលតម្លៃ `--primary`៖

```css
--primary: #8b5cf6;
--primary-hover: #7c4ee0;
```

ប្ដូរលេខកូដពណ៌ទាំងនេះទៅជាពណ៌ណាក៏បាន។

## របៀបប្ដូរទទឹង Sidebar

នៅក្នុង `variables.css` ផ្នែក `:root`៖

```css
:root {
  --sidebar-width: 260px;
}
```

ប្ដូរលេខ `260px` ទៅជាទទឹងផ្សេង។

## របៀបប្ដូរកម្ពស់ Header

```css
:root {
  --header-height: 64px;
}
```

## របៀបប្ដូរកម្រិត Blur (Glassmorphism)

រកមើលនៅក្នុង `sidebar.css`, `header.css`, ឬ `layout.css` (class `.glass`)៖

```css
backdrop-filter: blur(14px);
```

បង្កើនលេខ (ឧទាហរណ៍ `blur(24px)`) ដើម្បីធ្វើឱ្យព្រិលជាងមុន ឬបន្ថយលេខដើម្បីឱ្យច្បាស់ជាងមុន។

## របៀបប្ដូរ Border Radius

នៅក្នុង `variables.css`៖

```css
:root {
  --radius: 14px;
}
```

## របៀបប្ដូរ Font

បើកឯកសារ `src/styles/global.css` រកមើល៖

```css
body {
  font-family: "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
}
```

ប្ដូរបញ្ជីឈ្មោះ font ទៅតាមចំណង់ចំណូលចិត្តរបស់អ្នក។
