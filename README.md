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

## Draft creation from photos

The default flow is **Photos & model → Smart Fill → remaining manual details**. Enter the category, exact model and known RAM/storage variant for each group. **Create & fill all drafts** runs a separate internet-enabled AI request for every product, using the remembered available Gemini/ChatGPT provider. Cited specifications and empty product content fill together; existing values, price, stock, actual condition and parcel measurements are protected. After analysis, the combined editor shows prices, stock, required fields and optional specifications for all drafts. Manufacturer warranty and box contents need explicit confirmation under **Review AI results & sources**. Nothing is published automatically.

Use **Review / retry Smart Fill** to select a provider, correct a model or retry unfinished products. Successful products keep their results when another fails; cancellation and provider limits leave the manual editor available. Requests run sequentially and wait when needed to respect the API request limit. Without a verifiable exact model or available provider, missing fields remain manual.

**Create drafts only** skips AI. **Add manual details before Smart Fill** optionally exposes prices, MRP, stock, GST, condition, warranty, colour, SKU, supplier details, packed dimensions/weight, descriptions and category specifications before upload. Shared details fill empty fields; replacing entered values requires **Replace filled fields**. Grouped and one-per-photo modes keep details with their own photos, including after removal or regrouping. Initial manual details survive upload retries.

## Local self delivery

In **Settings > Orders & delivery**, enable **Local self delivery**, confirm the **Store location** on the map, set the radius (default **5 km**) and the local delivery fee, then save. Local delivery starts disabled; the existing courier/manual setup starts enabled. Each has its own enable/disable control, and switching them preserves saved provider credentials/configuration, fee rules and existing orders. Set the local fee to zero for free local delivery, or configure the separate optional local free-delivery minimum. The optional estimate is shown to customers without promising an automatic dispatch time.

At checkout, customers choose an enabled delivery method and confirm their saved address pin for local delivery. The backend checks straight-line distance from the saved store pin and calculates fees for COD and online payments. Orders outside the radius can use existing delivery when enabled. With only local delivery enabled, an outside-area address cannot place a delivery order. A confirmed payment and an existing order retain their saved fee and fulfillment method even if the admin later changes settings. Admin order details provide directions to the saved pin, a pin-correction flow before dispatch and the existing self-delivery status/contact controls.

Map tiles load on opening the picker, with attribution and browser caching following the [OpenStreetMap tile policy](https://operations.osmfoundation.org/policies/tiles/). Directions use [Google Maps URLs](https://developers.google.com/maps/documentation/urls/get-started); the store does not need a Google Maps API key for those links. GPS access is requested only when the person presses **Use my current location**.

## Phone app experience

This installation is for product sales. Rental menus, settings, product availability choices and customer booking pages are removed; old rental URLs lead to the product catalogue. The backend defaults to sales only and does not mount rental APIs or start rental workers (`ENABLE_RENTAL_MODULE=false`). Public catalogues exclude old rental-only stock, while an explicitly edited mixed listing can be saved as a sale product. Existing records and shared media references are retained. Deploy both the frontend and backend for this change.

The responsive storefront is also an installable Progressive Web App. It includes mobile navigation, product search and filters, product detail and sharing, bag, wishlist, address and payment checkout, orders and tracking, returns, profile, notifications, offline/update status, safe-area layout and home-screen shortcuts. The same backend remains the source of truth for identity, price, stock, coupons, payment and order state.

The catalog supports mobiles, electronics, accessories, home appliances and kitchen products. In **Categories**, choose a **Product field template** such as Televisions, Speakers, Screen guards, Washing machines, Irons, Pressure cookers or Mixer grinders. Use **Other products / custom specifications** for another product type, and add up to 30 typed fields under **Additional specification fields**. Fields can contain text, numbers with units, choices, dates or Yes/No values; required fields are checked before publishing. They are available in product forms, draft uploads, drafts and Smart Fill, and saved specifications appear in customer product details. Used custom fields cannot be removed or changed to an incompatible type/unit until their product and draft values are cleared.

Existing mobile and electronics configurations receive the extra templates when read; saved definitions and database configuration records are preserved. Smart Fill researches the exact selected product model and category fields using the chosen AI provider and cited sources. Price, stock and the actual item's condition remain manual. A configured API key, provider quota and an identifiable model are still required for internet research.

Update branding, owner phone, payment, media, SMS and shipping credentials in the new installation before deployment. Website Designer remains available to the project admin and publishes a shared theme across desktop, mobile, loaders and admin. Configure email and WhatsApp alerts in Settings > Order alerts; the settings panel includes provider instructions, testing and delivery history. Each client supplies its own credentials; alerts start disabled.

## Security

No existing `.env` file, database record, upload, Git history, build output or dependency is copied from the source platform. The one-time installation credential is newly generated for this client and can be revoked independently. Production builds omit source maps, deployment headers restrict script sources and framing, private API responses are not cached, CORS accepts only configured origins, and sensitive actions are validated by the backend. Browser JavaScript is public by design, so never put secrets or authorization decisions in frontend code.
