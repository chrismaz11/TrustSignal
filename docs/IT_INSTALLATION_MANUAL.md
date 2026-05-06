# IT Installation Manual & Configuration Guide

## 1. Environment Configuration

The following environment variables are required for the TrustSignal API and Core services (`apps/api` and `packages/core`).

For the authoritative and complete list, see `apps/api/.env.example`.

### Signing & Keys

- `PRIVATE_KEY`: Private key (hex) used for EVM anchor transactions (Sepolia).
- `POLYGON_AMOY_PRIVATE_KEY`: Private key for Polygon Amoy anchor transactions.
- `SOLANA_PAYER_SECRET_KEY`: (Optional) Solana payer secret key for Solana anchoring.

### API Authentication

- `TRUSTSIGNAL_LOCAL_DEV_API_KEYS`: Comma-separated list of API key IDs for local development.
- `TRUSTSIGNAL_LOCAL_DEV_API_KEY_SCOPES`: Scope mappings per key (e.g. `key_id=verify|read|anchor|revoke`).

### Database (PostgreSQL required)

- `DATABASE_URL`: Connection string for the Prisma database.
  - **Local Development**: `postgresql://user:password@localhost:5432/trustsignal`
  - **Production Environment**: Must use a managed cloud PostgreSQL instance with **storage encryption-at-rest enabled**.
  - **Production TLS Enforcement**: Connections must enforce TLS 1.2+. Append `?sslmode=require` to your connection string.

#### Backup and Restore Procedures

- **Backups**: Use `pg_dump -U [user] -h [host] -p [port] -F c -f backup.dump [db]` to create a compressed backup archive.
- **Restore**: Use `pg_restore -U [user] -h [host] -p [port] -d [db] -1 backup.dump` to restore inside a single transaction.

### External Integrations

- `ATTOM_API_KEY`: API key for property verification checks.
- `ATTOM_BASE_URL`: (Optional) Base URL for Attom Data if using a proxy.

### Blockchain Anchor

- `RPC_URL`: JSON-RPC endpoint for Sepolia EVM anchoring (e.g. Alchemy or Infura endpoint).
- `ANCHOR_REGISTRY_ADDRESS`: Deployed AnchorRegistry contract address (Sepolia).
- `POLYGON_AMOY_RPC_URL`: RPC endpoint for Polygon Amoy (default: `https://rpc-amoy.polygon.technology`).
- `POLYGON_AMOY_REGISTRY_ADDRESS`: Deployed AnchorRegistry contract address on Polygon Amoy.
- `SOLANA_RPC_URL`: (Optional) Solana RPC endpoint.
- `RFC3161_TSA_URL`: RFC 3161 timestamp authority URL (e.g. `https://freetsa.org/tsr` for demo; DigiCert or Sectigo for production).

### Runtime

- `PORT`: Port for the API server (default: 3001).

## 2. PRIA XML Schema Mapping (Reference — Deed Workflow)

> **Note:** This section applies to deed/property-record workflows only. It is not required for general TrustSignal deployments.

The following shows how TrustSignal verification fields map to PRIA (Property Records Industry Association) XML standards for deed recording integrations.

### Mapping Table

| TrustSignal Field            | PRIA XML XPath                          | Description                                        |
| ---------------------------- | --------------------------------------- | -------------------------------------------------- |
| `bundle.ron.sealPayload`     | `//Signatures/Signature/Keyinfo`        | Cryptographic evidence of the seal                 |
| `bundle.doc.docHash`         | `//Document/Hash`                       | Integrity hash of the recorded instrument          |
| `bundle.property.parcelId`   | `//Property/ParcelID`                   | County-assigned PIN/APN                            |
| `bundle.ocrData.grantorName` | `//Parties/Party[@Type='Grantor']/Name` | Grantor name extracted or verified                 |
| `receipt.receiptHash`        | `//Recording/Return/ReceiptHash`        | TrustSignal receipt hash                           |
| `receipt.decision`           | `//Recording/Status/Code`               | Mapped to `Verified` (ALLOW) or `Rejected` (BLOCK) |

## 3. Installation Steps

1. **Clone Repository**: `git clone https://github.com/TrustSignal-dev/TrustSignal.git`
2. **Install Dependencies**: `npm install` (at root)
3. **Configure Environment**:
   ```bash
   cp .env.example .env.local
   cp apps/api/.env.example apps/api/.env
   # Edit apps/api/.env and set required variables
   ```
4. **Database Migration**:
   ```bash
   npm -w apps/api run db:generate
   npm -w apps/api run db:push
   ```
5. **Build Core**:
   ```bash
   npm -w packages/core run build
   ```
6. **Start API** (port 3001):
   ```bash
   npm -w apps/api run dev
   ```
7. **Start Web App** (port 3000, optional):
   ```bash
   npm -w apps/web run dev
   ```
