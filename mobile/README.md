# My Clinic mobile

Expo (React Native) client for the My Clinic dental CRM. It is a separate project in this folder: its own `package.json`, its own dependencies, and no changes to the Vite web app at the repo root.

iOS bundle id and Android package: `com.myclinic.app`. App name: **My Clinic**. Slug: `my-clinic`. Version `1.0.0`, portrait.

## What v1 includes

- Login that matches the web CRM: custom `users` table (clinic ID + username + password), not Supabase Auth. Passwords are checked with bcrypt, and older plaintext values still match. The clinic must exist, have status `Active`, and not be past `expires_at`.
- Tabs: home (today’s appointments), appointments, patients, profile (clinic stub + logout).
- Lists are filtered with `clinic_id` from the signed-in user.
- Uzbek (Latin) copy, teal/cyan UI, safe areas.

## Run locally

```bash
cd mobile
npm install
cp .env.example .env
```

Fill `.env` (this file is gitignored; only `.env.example` is committed):

```
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

Use the same Supabase project as the web app (`VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`). Do not commit the real key.

```bash
npx expo start
```

Then open Expo Go, an Android emulator, or an iOS simulator. `npm run android` and `npm run ios` do the same. `npm run typecheck` runs `tsc --noEmit`.

## EAS: App Store and Google Play

Install the CLI once: `npm install -g eas-cli` (or use `npx eas-cli`).

1. `npx eas-cli login`
2. From `mobile/`, link the project: `npx eas-cli init`  
   This writes the EAS project id into `app.json`.
3. Build profiles in `eas.json`:
   - `development` — dev client. iOS simulator build, Android APK.
   - `preview` — internal install on real iPhones and Android devices (Android APK).
   - `production` — store binaries. iOS App Store build, Android App Bundle (`.aab`).

```bash
npx eas-cli build --profile development --platform all
npx eas-cli build --profile preview --platform all
npx eas-cli build --profile production --platform all
```

Submit the production build:

```bash
npx eas-cli submit --profile production --platform ios
npx eas-cli submit --profile production --platform android
```

iOS submit needs an Apple Developer account. EAS will ask for your Apple ID, App Store Connect app, and team the first time (`eas.json` leaves `submit.production.ios` empty on purpose).

Android submit uses the `production` Play track. Create a Google Play service account, download the JSON key, and either pass it when EAS asks or set `submit.production.android.serviceAccountKeyPath`. Keep that JSON file out of git (`google-service-account.json` is ignored).

Store listing assets: `assets/images/icon.png` (app icon) and `assets/images/splash-icon.png` (splash). Replace the placeholders before the first store release.
