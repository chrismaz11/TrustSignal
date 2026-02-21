# IT Installation Manual & Configuration Guide

## 1. Environment Configuration

The following environment variables are required for the Deed Shield API and Core services (`apps/api` and `packages/core`).

### System Identity

- `ISSUER_DID`: The decentralized identifier for the Deed Shield instance (e.g., `did:web:deedshield.io`).
- `SIGNING_PRIVATE_KEY`: Private key (PKCS8 PEM or Hex) used to sign receipts.

### Database (PostgreSQL required)

- `DATABASE_URL`: Connection string for the Prisma database.
  - **Local Development**: `postgresql://user:password@localhost:5432/deed_shield` (Deploy local DB using `docker-compose up -d` at root).
  - **Production Environment**: Must use a managed cloud PostgreSQL instance with **storage encryption-at-rest enabled**.
  - **Production TLS Enforcement**: Connections must enforce TLS 1.3. Your production connection string must append `?sslmode=require`. Example: `postgresql://[user]:[password]@[host]:[port]/[db]?sslmode=require`.

#### Backup and Restore Procedures

- **Backups**: Use `pg_dump -U [user] -h [host] -p [port] -F c -f backup.dump [db]` to create a compressed backup archive.
- **Restore**: Use `pg_restore -U [user] -h [host] -p [port] -d [db] -1 backup.dump` to restore inside a single transaction.

### External Integrations

- `ATTOM_API_KEY`: API Key for property verification checks.
- `ATTOM_BASE_URL`: (Optional) Base URL for Attom Data if using a proxy.

### Blockchain Anchor (Optional)

- `RPC_URL`: JSON-RPC endpoint for the anchor chain (e.g., Polygon Mainnet).
- `REGISTRY_ADDRESS`: Smart contract address for the Notary/Trust Registry (if applicable).
- `ANCHOR_PRIVATE_KEY`: Private key for the wallet submitting anchor transactions.

### Runtime

- `PORT`: Port for the API server (default: 3001).

## 2. PRIA XML Schema Mapping (Phase 2)

For the next integration phase, we will map internal Deed Shield JSON Bundle schemas to PRIA (Property Records Industry Association) XML standards.

### Mapping Table

| Deed Shield Field            | PRIA XML XPath                          | Description                                        |
| ---------------------------- | --------------------------------------- | -------------------------------------------------- |
| `bundle.ron.sealPayload`     | `//Signatures/Signature/Keyinfo`        | Cryptographic evidence of the seal                 |
| `bundle.doc.docHash`         | `//Document/Hash`                       | Integrity hash of the recorded instrument          |
| `bundle.property.parcelId`   | `//Property/ParcelID`                   | County-assigned PIN/APN                            |
| `bundle.ocrData.grantorName` | `//Parties/Party[@Type='Grantor']/Name` | Grantor name extracted or verified                 |
| `receipt.receiptHash`        | `//Recording/Return/ReceiptHash`        | **New Field**: Deed Shield Receipt Hash            |
| `receipt.decision`           | `//Recording/Status/Code`               | Mapped to `Verified` (ALLOW) or `Rejected` (BLOCK) |

## 3. Installation Steps

1.  **Clone Repository**: `git clone <repo_url>`
2.  **Install Dependencies**: `npm install` (at root)
3.  **Database Migration**:
    ```bash
    cd apps/api
    npx prisma db push
    ```
4.  **Build Core**:
    ```bash
    cd packages/core
    npm run build
    ```
5.  **Start API**:
    ```bash
    cd apps/api
    npm run dev
    ```
