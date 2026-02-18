# Deed Shield API — Developer Setup

## Prerequisites

- **Node.js** ≥ 18
- **PostgreSQL** ≥ 14 (local or remote)
- **npm** ≥ 9

## 1. Clone & Install

```bash
git clone git@github.com:chrismaz11/Deed_Shield.git
cd Deed_Shield
npm install            # installs all workspaces
```

## 2. Create Your Local Environment File

> **⚠ Never commit `.env` or `.env.local` — they are git-ignored.**

Copy the template and fill in your own values:

```bash
cp apps/api/.env.example apps/api/.env
```

### Required Variables

| Variable           | Description                                | Example                                             |
| ------------------ | ------------------------------------------ | --------------------------------------------------- |
| `DATABASE_URL`     | PostgreSQL connection string               | `postgresql://user:pass@localhost:5432/deed_shield` |
| `ATTOM_API_KEY`    | ATTOM Data API key (obtain from team lead) | `ak_...`                                            |
| `OPENAI_API_KEY`   | OpenAI key for compliance checks           | `sk-...`                                            |
| `PRIVATE_KEY`      | Ethereum wallet private key for anchoring  | `0x...`                                             |
| `RPC_URL`          | EVM JSON-RPC endpoint                      | `https://sepolia.infura.io/v3/...`                  |
| `REGISTRY_ADDRESS` | On-chain registry contract address         | `0x...`                                             |

### Optional Variables

| Variable            | Default                             | Description         |
| ------------------- | ----------------------------------- | ------------------- |
| `PORT`              | `3001`                              | API listen port     |
| `RATE_LIMIT_MAX`    | `100`                               | Requests per window |
| `RATE_LIMIT_WINDOW` | `1 minute`                          | Rate-limit window   |
| `ATTOM_BASE_URL`    | `https://api.gateway.attomdata.com` | ATTOM API base URL  |

## 3. Set Up the Database

### Local PostgreSQL (recommended for development)

```bash
# Create the database
createdb deed_shield

# Set DATABASE_URL in apps/api/.env
# DATABASE_URL="postgresql://localhost:5432/deed_shield"

# Run migrations
cd apps/api
npx prisma migrate deploy

# (Optional) Seed with demo data
npx prisma db seed
```

### Docker PostgreSQL (alternative)

```bash
docker run -d \
  --name deed-shield-pg \
  -e POSTGRES_DB=deed_shield \
  -e POSTGRES_PASSWORD=localdev \
  -p 5432:5432 \
  postgres:16-alpine

# Then set: DATABASE_URL="postgresql://postgres:localdev@localhost:5432/deed_shield"
```

## 4. Run the API

```bash
cd apps/api
npm run dev
# API available at http://localhost:3001
```

## 5. Run Tests

```bash
cd apps/api
npm test
```

> **Note:** Tests require a running PostgreSQL instance with a valid `DATABASE_URL`.

## Security Reminders

- **All API endpoints** (except `GET /health`) require an `x-api-key` header tied to a registered Organization.
- **Never commit** `.env`, `.env.local`, `*.sqlite`, or key files.
- **Secrets** are obtained from team leads or a secrets manager — never shared via chat or email.
- The `.gitignore` is configured to block these files. Do not modify it to allow them.
