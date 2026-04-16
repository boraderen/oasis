This frontend is a statically exportable [Next.js](https://nextjs.org) app for Oasis.

## Local Development

Run the frontend dev server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

For the full project setup, Docker usage, backend deployment, and GitHub Pages deployment instructions, use the root repository README.

## Static Export

The app is configured with `output: "export"` in `next.config.ts`, so `npm run build` produces a static `out/` directory for GitHub Pages deployment.

Required build-time environment variables:

- `NEXT_PUBLIC_API_URL`
- `NEXT_PUBLIC_BASE_PATH`

Example:

```bash
NEXT_PUBLIC_API_URL=https://your-backend.onrender.com \
NEXT_PUBLIC_BASE_PATH=/oasis \
npm run build
```
