# Resume Builder

A React and Vite resume builder with a live preview, repeatable education and
experience sections, Gemini-powered skill suggestions and summaries, and PDF
export.

The AI features currently use Google's `gemini-3.5-flash-lite` model.

## Getting started

```sh
npm install
```

Create a `.env.local` file in the project root and put the Gemini key on the
backend-only variable. Do not use a `VITE_` prefix:

```env
GEMINI_API_KEY=your_gemini_api_key
```

Run the API and frontend in separate terminals:

```sh
npm run dev:api
npm run dev
```

The Vite development server proxies `/api` requests to the local API at port
3001. The Gemini key is read only by the backend and is never included in the
frontend bundle.

## Deploying to Render

Deploy two services from the same Git repository:

### Backend Web Service

- **Root Directory:** leave blank
- **Build Command:** `npm install`
- **Start Command:** `npm run start:api`
- Add `GEMINI_API_KEY` with your Google AI Studio key.
- Add `FRONTEND_ORIGIN` with the full Render Static Site origin, such as
  `https://your-site.onrender.com` (no trailing slash).

Render provides the `PORT` environment variable automatically.

### Frontend Static Site

- **Root Directory:** leave blank
- **Build Command:** `npm install && npm run build`
- **Publish Directory:** `dist`
- Add `VITE_API_BASE_URL` with the backend Web Service URL, such as
  `https://your-api.onrender.com` (no trailing slash).

Save and redeploy the Static Site after adding `VITE_API_BASE_URL`, since Vite
uses it while building the frontend. Never add `GEMINI_API_KEY` to the Static
Site.

Run `npm run build` to create a production build and `npm run lint` to check
the source. Use **Export to PDF** above the live preview to download your
current resume.
