import { canonicalize } from 'json-canonicalize';

export function canonicalizeJson(value: unknown): string {
  return canonicalize(value);
}
