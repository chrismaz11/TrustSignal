import { keccak256, toUtf8Bytes } from "ethers";

export function keccak256Utf8(input: string): string {
  return keccak256(toUtf8Bytes(input));
}

export function keccak256Buffer(input: Uint8Array): string {
  return keccak256(input);
}
