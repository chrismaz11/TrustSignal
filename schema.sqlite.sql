-- SQLite schema for Record Event Attestation MVP

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS issuers (
  did TEXT PRIMARY KEY,
  public_jwk_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS credentials (
  jti TEXT PRIMARY KEY,
  jwt TEXT NOT NULL,
  issued_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS revocations (
  jti TEXT PRIMARY KEY,
  revoked_at TEXT NOT NULL
);
