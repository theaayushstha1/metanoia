# Metanoia

Personalized procurement for developer/API subscriptions. A Gemini buyer-agent compares
three curated offers, while deterministic ranking and SpendGuard enforce requirements and
budget before an embedded Hyperswitch sandbox checkout.

## Run

```bash
cd /Users/theaayushstha/Desktop/JusPay/metanoia
npm run dev
```

Open `http://localhost:3000`.

Required local configuration belongs in `.env.local`; never commit it. Vertex uses local
Application Default Credentials unless `GOOGLE_VERTEX_CREDENTIALS` is provided.

## Verify

```bash
npm run build
npm run lint
npm test
```

See `STATUS.md` for verified, externally blocked, and deferred scope.
