# Recipe Parse API

Server-side only. **Never** expose `OPENAI_API_KEY` to the client.

## Setup

1. Add to your **`.env`** (project root, same as Vite):
   ```
   OPENAI_API_KEY=sk-your-openai-key
   ```
   Do **not** use `VITE_` or `NEXT_PUBLIC_` prefix.

2. Run the server (in a separate terminal):
   ```bash
   npm run server
   ```
   Listens on `http://localhost:3001` by default. Override with `PARSE_SERVER_PORT`.

3. Run the app:
   ```bash
   npm run dev
   ```
   Vite proxies `/api` to the parse server, so the client calls `/api/parse-recipe` without CORS.

## Endpoint

- **POST /api/parse-recipe**  
  Body: `{ "text": "raw recipe text" }`  
  Returns structured JSON (title, ingredients, times, instructions). Used by "Add Recipe with AI" in Meal Planning.
