## Public Contracts

This package is intended to remain in the public integration-layer repository.

It contains:
- API-facing types and receipt schemas
- receipt hashing and signature verification helpers
- registry signature verification helpers
- public adapter types used by the API and SDK

Do not add:
- proof generation or proof verification orchestration
- risk scoring or compliance evaluation logic
- receipt signing or anchoring implementations
- oracle dispatch or private model/circuit code
