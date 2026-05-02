# Secure HoloTriad Demo (Cloudflare Worker)

This is a clean, minimal demo that completely hides your proprietary SEIS-UGFM architecture and prompts from the client, designed to run for free on Cloudflare Workers.

## Why Cloudflare Workers?
Cloudflare Workers give you 100,000 free requests per day, don't require `npm`, don't require you to log into random CLIs on your computer, and run instantly at the edge.

## How to Deploy (Takes 60 Seconds)

1. **Go to Cloudflare Dashboard**:
   - Log into [dash.cloudflare.com](https://dash.cloudflare.com).
   - On the left sidebar, click **Compute**, then click **Workers & Pages**.
   - Click the blue **Create** button.
   - Click **Create Worker**.
   - Name it `holotriad-secure` (or whatever you want) and click **Deploy**.

2. **Add Your Code**:
   - Click **Edit Code** on the newly created Worker.
   - Open `worker.js` from this folder (`C:\Users\ESPPa\Favorites\rss-secure-cloudflare\worker.js`).
   - Copy all the code from `worker.js` and paste it into the Cloudflare code editor, replacing the default code.
   - Click **Save and Deploy** in the top right.

3. **Add Your Secret xAI Key**:
   - Go back to your Worker's main page in the Cloudflare dashboard.
   - Go to **Settings** -> **Variables**.
   - Under **Environment Variables**, click **Add variable**.
   - Set **Variable name** to `XAI_API_KEY`.
   - Set **Value** to your actual xAI key.
   - Click the **Encrypt** button to hide it securely.
   - Click **Save and Deploy**.

4. **Connect the Frontend**:
   - Take the public URL Cloudflare gives you for your worker (e.g. `https://holotriad-secure.yourname.workers.dev`).
   - Edit the `public/index.html` file in this folder, and change `/api/run` to your new Cloudflare URL.
   - You can now host that `index.html` file *anywhere* (even just email it to them, or throw it on GitHub pages), and it will securely call your Cloudflare worker. They cannot see your API key or your prompts.
