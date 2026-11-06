# Resume Builder

A React and Vite resume builder with a live preview, repeatable education and
experience sections, Gemini-powered skill suggestions and summaries, and PDF
export.

The AI features currently use Google's `gemini-3.5-flash-lite` model.

## Getting started

```sh
npm install
npm run dev
```

To enable AI skill suggestions, create a `.env.local` file in the project root:

```sh
VITE_GEMINI_API_KEY=your_gemini_api_key
```

Restart the Vite server after adding the key. Vite exposes `VITE_` variables in
the browser bundle, so this direct API integration is intended for local demos.
Use a server-side proxy to protect the key in a deployed application.

Run `npm run build` to create a production build and `npm run lint` to check
the source. Use **Export to PDF** above the live preview to download your
current resume.
