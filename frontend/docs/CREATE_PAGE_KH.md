# របៀបបង្កើតទំព័រថ្មី

នេះជាជំហានៗសម្រាប់បង្កើតទំព័រថ្មីមួយ ហើយភ្ជាប់វាទៅ Sidebar និង Routing។

## ជំហានទី ១៖ បង្កើតឯកសារទំព័រថ្មី

ទៅកាន់ថត `src/pages/` ហើយបង្កើតឯកសារថ្មីមួយឈ្មោះ `Example.jsx`

## ជំហានទី ២៖ សរសេរកូដ JSX

ចម្លងគំរូខាងក្រោមទៅដាក់ក្នុងឯកសារ `Example.jsx`៖

```jsx
import { useLanguage } from "../context/LanguageContext";

function Example() {
  const { t } = useLanguage();

  return (
    <div className="page">
      <h2 className="page-heading">ទំព័រឧទាហរណ៍</h2>
      <p className="page-subtitle">នេះជាទំព័រថ្មីមួយ។</p>

      <div className="card glass">
        <p>អ្នកអាចកែប្រែមាតិកានៅទីនេះ។</p>
      </div>
    </div>
  );
}

export default Example;
```

## ជំហានទី ៣៖ បន្ថែម Route នៅក្នុង App.jsx

បើកឯកសារ `src/App.jsx` ហើយ៖

1. Import ទំព័រថ្មីនៅខាងលើ៖

```jsx
import Example from "./pages/Example";
```

2. បន្ថែម `<Route>` ថ្មីនៅខាងក្នុង `<Route path="/" element={<MainLayout />}>`៖

```jsx
<Route path="example" element={<Example />} />
```

## ជំហានទី ៤៖ បន្ថែមមុខទំព័រនៅ Sidebar

មើលឯកសារ `docs/ADD_SIDEBAR_ITEM_KH.md` សម្រាប់ការពន្យល់លម្អិត។ សង្ខេបគឺបន្ថែម object ថ្មីនៅក្នុង `src/data/sidebarItems.js`៖

```js
{
  labelKey: "example",
  icon: "ri-star-line",
  path: "/example",
}
```

កុំភ្លេចបន្ថែម `example: "ឧទាហរណ៍"` ទៅក្នុង `translations` នៅក្នុងឯកសារ `LanguageContext.jsx` ផងដែរ (ទាំងជាភាសាអង់គ្លេស និងខ្មែរ)។

## ជំហានទី ៥៖ សាកល្បងទំព័រ

រក្សាទុកឯកសារទាំងអស់ ហើយត្រឡប់ទៅ Browser វិញ។ ចុច Sidebar item ថ្មីរបស់អ្នក ដើម្បីមើលថាទំព័រលេចឡើងត្រឹមត្រូវដែរឬទេ។
