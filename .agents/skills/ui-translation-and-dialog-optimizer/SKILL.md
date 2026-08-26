---
name: ui-translation-and-dialog-optimizer
description: >-
  Refactor and translate a specific UI section, page, or dialog (e.g. patients, appointments, payments) professionally into English, Russian, and Uzbek, while optimizing dialog/modal layout structure and strictly preventing any code variables or technical keys (like `patient`, `wizard`, `patent`, internal object properties, database fields) from leaking or being displayed to the user. Triggered by requests like "bemorlar bo'limini professional tarjima qilib ber", "bo'limni o'zbek, rus, ingliz tillarida professional qil", "dialog oynalarini/qo'shish oynalarini professional qilib tarjima qil", "translate UI section professionally".
---

# UI Translation & Dialog Optimizer

## Overview
This skill focuses on localizing user interfaces professionally in three languages (Uzbek, Russian, and English) and optimizing dialog/modal dialog designs (especially "add/edit" wizards and forms). The critical constraint is that **no technical variable names, internal identifiers, or database keys (such as `patient`, `wizard`, `patent`, `createdAt`, `user_id`, etc.) must ever be visible in the user interface.** Everything must be mapped to clean, professional, human-friendly translation keys.

## Dependencies
- [`ui-section-optimizer`](file:///c:/Users/aveks/Desktop/app%20shahobidin%204/.agents/skills/ui-section-optimizer/SKILL.md)
- [`regression-preventer`](file:///c:/Users/aveks/Desktop/app%20shahobidin%204/.agents/skills/regression-preventer/SKILL.md)

## Quick Start
When a user asks to translate a section or dialog professionally:
1. Locate the component files (e.g., `PatientModal.jsx`, `NewPatientFlow.jsx`).
2. Scan the JSX for hardcoded text and raw variables being rendered.
3. Import `useTranslation` from `src/i18n/LanguageContext.jsx` if not already present.
4. Extract all user-facing strings into localization keys using `t('section.key')`.
5. Populate `uz.json`, `ru.json`, and `en.json` in `src/i18n/translations/` with high-quality translations.
6. Verify that the UI looks premium, input fields are aligned, cancel/close buttons are accessible, and **no internal code words are exposed**.

## Workflow

### 1. Component & Context Scan
- Find all component files that make up the target section (e.g. list, profile page, add wizard, modal).
- Scan JSX elements for any raw text nodes, placeholders, tooltips, validation messages, and table column headers.
- Identify database-backed values or raw code variables that are directly printed without translations.

### 2. Strict Technical Key Leak Prevention (Kodlarni Yashirish)
- **Rule:** Never print raw database fields, JSON keys, or JavaScript variable names to the user screen.
- For example, if rendering dynamic list fields or keys, translate them dynamically or map them to localized labels:
  - DO NOT output: `patient`, `patent`, `wizard`, `status`, `createdAt`, `user_id`, `updatedAt`, `total_debt`.
  - DO output: Localized strings via `t()` (e.g. "Bemor ismi" / "Имя пациента" / "Patient Name", "Qarz" / "Долг" / "Debt").
- Ensure error messages and placeholders are also sanitized and translated.

### 3. Localization and Translation Sync (Lokalizatsiya)
- Import the translation hook:
  ```javascript
  import { useTranslation } from '../i18n/LanguageContext';
  // Inside component:
  const { t, language } = useTranslation();
  ```
- Replace hardcoded texts:
  ```diff
  - <label>Patient Name</label>
  + <label>{t('patients.patientName')}</label>
  ```
- Open the three translation JSON files:
  - [`uz.json`](file:///c:/Users/aveks/Desktop/app%20shahobidin%204/src/i18n/translations/uz.json)
  - [`ru.json`](file:///c:/Users/aveks/Desktop/app%20shahobidin%204/src/i18n/translations/ru.json)
  - [`en.json`](file:///c:/Users/aveks/Desktop/app%20shahobidin%204/src/i18n/translations/en.json)
- Add matching keys with professional translations:
  - **Uzbek Standard**: Use correct special characters: `o'`, `g'`, `ch`, `sh` (e.g., `tashxis`, `bemor`, `shifokor`).
  - **Russian Standard**: Use proper medical endings, noun cases, and syntax (e.g., `Пациент`, `Диагноз`, `Запись`).
  - **English Standard**: Keep standard title casing or sentence casing (e.g., `Patient Name`, `Add New Patient`).

### 4. Dialog & Modal UX Optimization (Oynalarni Professional Qilish)
- Optimize spacing, borders, cards, and colors to match the app's premium theme.
- Ensure dialog inputs are arranged in logical grids (e.g. flexbox or responsive grid layouts).
- **Navigation Controls:**
  - Standardize "Close (X)" buttons on the top right header.
  - Provide a clear "Cancel" (Bekor qilish) button at the bottom-left of the dialog action bar.
  - Provide a "Save / Next" (Saqlash / Keyingisi) button at the bottom-right.
  - In multi-step wizards, ensure a progress line is displayed clearly indicating steps.

### 5. Verification & Regression Check (To'liq Ishlash Kafolati)
After completing edits, verify the section works completely and no regressions occur:
- **Z-Index Layering Check:** Ensure that if there's a search dropdown (like `PatientSelect`), it opens on top of all subsequent input fields and doesn't get hidden behind them.
- **Scroll Lock Check:** Verify modals/dialogs do not cause container jumping or layout shifting on mobile screens.
- **Form Submission Check:** Verify adding, editing, or saving data actually commits values and updates parent state without JS crashes.
- **Dynamic Translation Check:** Change the language context dynamically in the app and verify all UI labels in the modified section react immediately without freezing or rendering empty tags.

## Common Mistakes
- **Leaked Codes:** Leaving developer strings or raw variables like `patient`, `patent`, `wizard` rendered in the UI instead of translating them.
- **Asymmetric Translation Keys:** Adding a translation key to `uz.json` but forgetting to add it to `ru.json` and `en.json`, which outputs the raw key string.
- **JSON Errors:** Accidentally deleting commas or double quotes when editing translation files, crashing the translation context.
- **Missing Cancel/Close:** Designing dialogs where the user can't close the modal easily (e.g. no "X" button or no "Bekor qilish" option).
