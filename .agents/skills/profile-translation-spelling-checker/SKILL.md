---
name: profile-translation-spelling-checker
description: >-
  Check, analyze, and correct spelling, grammar, and translation consistency (Uzbek, Russian, English) in the patient profile and related UI files. Triggered by queries like "profilini tekshir", "so'zlarni tekshir", "tarjimalarni tekshir", "bemor profilidagi so'zlarni tekshir", "check profile spelling", "validate profile translations", "imlo xatolarini to'g'rilash".
---

# Profile Translation & Spelling Checker

## Overview
This skill focuses on scanning, reviewing, and correcting spelling errors, grammatical mistakes, and translation inconsistencies (English, Uzbek, Russian) across the patient profile system. It ensures that all medical terminology, labels, inputs, and static text display correctly in all supported languages.

## Dependencies
None.

## Quick Start
When the user asks to check words or translations on the patient profile:
1. Locate the main files related to the patient profile, primarily [PatientProfile.jsx](file:///c:/Users/aveks/Desktop/app%20shahobidin%204/src/pages/PatientProfile.jsx) and the translations directory [translations](file:///c:/Users/aveks/Desktop/app%20shahobidin%204/src/i18n/translations).
2. Scan the text strings, labels, and placeholders from the beginning of the file to the end.
3. Check the translation files (`uz.json`, `ru.json`, `en.json`) for keys used in the profile to verify they match and are translated correctly.
4. Correct spelling errors in Uzbek (e.g., `o'`, `g'`, `ch`, `sh` characters), Russian (typos, grammatical cases), and English.
5. Provide a step-by-step summary of corrected words and translations to the user.

## Workflow

### 1. File & Context Scan (Boshidan Oxirigacha O'rganish)
- Open the target profile view or component (e.g., [PatientProfile.jsx](file:///c:/Users/aveks/Desktop/app%20shahobidin%204/src/pages/PatientProfile.jsx)).
- Read it from the top down. Identify all user-facing text, button labels, placeholders, tooltips, and table headers.
- Identify whether these texts are hardcoded or mapped to translation keys (using `t('key')` or `LanguageContext`).

### 2. Spell Checking & Correcting (So'zlarni To'g'rilash)
- **Uzbek (uz):** Check for correct usage of characters like `o'`, `g'`, `h`/`x`, `sh`, `ch`. For example:
  - Correct `bemor` (not `bimor`).
  - Correct `tashxis` (not `tashxiz`).
  - Correct `muolaja` (not `malaja` or `mualoja`).
- **Russian (ru):** Verify correct endings, suffixes, and medical terminology spelling (e.g., `пациент`, `диагноз`, `лечение`, `приём`).
- **English (en):** Verify proper English spelling and capitalization rules (e.g., `Patient`, `Diagnosis`, `Treatment`, `Appointment`).

### 3. Translation Alignment & Sync (Ko'p Tilli Kontrol)
- Locate the translation files:
  - [uz.json](file:///c:/Users/aveks/Desktop/app%20shahobidin%204/src/i18n/translations/uz.json)
  - [ru.json](file:///c:/Users/aveks/Desktop/app%20shahobidin%204/src/i18n/translations/ru.json)
  - [en.json](file:///c:/Users/aveks/Desktop/app%20shahobidin%204/src/i18n/translations/en.json)
- For every updated translation key, verify that:
  - The key exists in all three files.
  - The meaning is preserved and accurately translated.
  - No empty values or placeholders are left.
- If a string is hardcoded in `PatientProfile.jsx`, refactor it to use the localization context so that it can be translated into Uzbek, Russian, and English.

### 4. Verification and Execution
- Apply changes using `replace_file_content` or `multi_replace_file_content`.
- Double-check that JSON syntax remains valid in the translations folder.
- Ensure that JSX syntax in frontend components is not broken.

## Common Mistakes
- **Incomplete Translations:** Correcting a word in `uz.json` but forgetting to verify or update it in `ru.json` or `en.json`.
- **Breaking JSON Syntax:** Accidentally deleting commas or double quotes in translation files.
- **Ignoring Uzbek Special Letters:** Replacing proper Uzbek Latin characters with plain ones (e.g., writing `o` instead of `o'`, `g` instead of `g'`). Always use the correct Uzbek typographic standard.
