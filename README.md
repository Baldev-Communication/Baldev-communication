# Baldev Communication

A standalone Mobile Store commerce project generated for **Baldev Communication**. It has its own source tree and must use its own database, storage and service credentials. Master Configuration, Store Portfolio and project-generation tools are intentionally absent from this client project.
## Managed installation

This package has one unique, revocable installation identity. Open `client-installation.json`, copy its values into the **backend hosting environment**, and then permanently delete that file before committing or sharing the project. Never put `CLIENT_LICENSE_KEY` in the frontend. The admin **System & updates** screen shows subscription, limits, connection state and assigned updates without exposing that key.

## Start locally

1. Extract this folder.
2. Copy `.env.example` to `.env`.
3. Copy `backend/.env.example` to `backend/.env`.
4. Set a new MongoDB database URL and replace the JWT secrets.
5. If present, transfer `client-installation.json` values to the backend environment and delete the file.
6. Run `npm install` in this folder and in `backend`.
7. Run `npm run server` in one terminal and `npm start` in another.

## Product Smart Fill AI

Product, Quick Add and Product Draft forms let users choose **Gemini** or **ChatGPT** before generating suggestions from the product name, uploaded photos or supplier notes. The selected provider also researches technical specifications when internet search is enabled. Users review sources and apply suggestions before saving. Unconfigured providers appear disabled; the last available provider choice is remembered in that browser. AI failures do not switch to another provider automatically.

For mobile/electronics catalogs, Smart Fill automatically adds cited technical specifications to empty fields by default. Users can turn this off to review everything first. Existing values and edits made during analysis are protected, and the fill can be undone. Warranty, box contents, condition, sales prices and stock still need review or manual entry. Quick Add photo analysis also uses the shared specification lookup for technology products. A failed lookup shows its reason; `AI_QUOTA_EXCEEDED` requires checking that provider's API billing/limits or waiting for its limit to reset.

Configure the providers in the **backend hosting environment** (locally, `backend/.env`):

```dotenv
GEMINI_API_KEY=
OPENAI_API_KEY=
OPENAI_MODEL=gpt-5.4-mini
```

Set only the keys for providers you want to enable, then restart or redeploy the backend. `OPENAI_MODEL` is optional; the default is `gpt-5.4-mini`. A replacement model must support image inputs, JSON output and Responses API web search. API billing and model permissions must be enabled for the selected provider. Keys stay on the backend; never add them to `REACT_APP_*` variables or frontend files. Existing reel video analysis continues to use Gemini. Without either key, explicitly stated notes can still be parsed without AI.

Implementation references: [OpenAI image inputs](https://developers.openai.com/api/docs/guides/images-vision), [web search and citations](https://developers.openai.com/api/docs/guides/tools-web-search), [default model capabilities](https://developers.openai.com/api/docs/models/gpt-5.4-mini).

## Phone app experience

The responsive storefront is also an installable Progressive Web App. It includes mobile navigation, product search and filters, product detail and sharing, bag, wishlist, address and payment checkout, orders and tracking, returns, profile, notifications, offline/update status, safe-area layout and home-screen shortcuts. The same backend remains the source of truth for identity, price, stock, coupons, payment and order state.

The default catalog uses **Mobile Store** with 16 product fields and 31 category definitions. Update branding, owner phone, payment, media, SMS and shipping credentials in the new installation before deployment. Website Designer remains available to the project admin and publishes a shared theme across desktop, mobile, loaders and admin. Configure email and WhatsApp alerts in Settings > Order alerts; the settings panel includes provider instructions, testing and delivery history. Each client supplies its own credentials; alerts start disabled.

## Security

No existing `.env` file, database record, upload, Git history, build output or dependency is copied from the source platform. The one-time installation credential is newly generated for this client and can be revoked independently. Production builds omit source maps, deployment headers restrict script sources and framing, private API responses are not cached, CORS accepts only configured origins, and sensitive actions are validated by the backend. Browser JavaScript is public by design, so never put secrets or authorization decisions in frontend code.
