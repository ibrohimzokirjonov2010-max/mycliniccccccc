# Privacy answers

These answers match the mobile app in this repo. They are not a lawyer’s opinion. Review them before you submit.

The app collects data so clinic staff can run the CRM. It does not use an advertising SDK, analytics SDK, or crash SDK. It does not ask for location, camera, microphone, contacts, or photos. It does not store a card number or CVV. The password is sent only to sign in and is not saved on the device. The session token is stored in the iOS Keychain or Android Keystore.

Data is sent over HTTPS to the clinic server (`https://app-shahobidin-4.vercel.app` and the clinic Supabase project). It is linked to the staff account. It is not sold and not used for tracking.

## Apple App Privacy (nutrition label)

Tracking: No.

Data used to track you: none.

Data linked to the user, purpose App Functionality:

| Type | Collected | Notes |
| --- | --- | --- |
| Contact Info — Name | Yes | Staff name and patient name |
| Contact Info — Phone Number | Yes | Staff phone if present, patient phone |
| Contact Info — Email | No | The mobile app does not ask for email |
| Health — Health | Yes | Visit service name entered by staff (for example a treatment name) |
| Financial Info — Other Financial Info | Yes | Payment amount and method (cash, card, or transfer). No card number |
| Identifiers — User ID | Yes | Clinic staff id |
| User Content — Other User Content | Yes | Optional visit service text |
| Diagnostics, Location, Contacts, Photos, Browsing, Search, Purchases of ads | No | Not collected |

Data not linked to the user: none.

Third-party advertising: No.

## Google Play Data safety

Does the app collect or share user data? Collects. Does not share with third parties for their own purposes. The clinic server processes data for the clinic.

Is all collected data encrypted in transit? Yes.

Do you provide a way for users to request deletion? Yes. In the app: Account → Delete account. On the web: https://app-shahobidin-4.vercel.app/delete-account

| Data type | Collected | Shared | Optional | Purpose |
| --- | --- | --- | --- | --- |
| Personal info — Name | Yes | No | No | App functionality |
| Personal info — Phone number | Yes | No | No | App functionality |
| Financial info — Other financial info | Yes | No | No | App functionality. Amount and method only |
| Health and fitness — Health info | Yes | No | No | App functionality. Treatment name on a visit |
| App activity, device IDs, location, photos, audio, contacts, calendar, web history | No | No | — | Not collected |
| App info and performance — Crash logs / Diagnostics | No | No | — | No crash SDK |

Data is required for the account. There is no advertising data and no data sale.
