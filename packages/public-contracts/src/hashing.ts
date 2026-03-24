import { keccak256, toUtf8Bytes } from 'ethers';

export function keccak256Utf8(input: string): string {
  return keccak256(toUtf8Bytes(input));
}
