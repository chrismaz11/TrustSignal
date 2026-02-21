import { AttomClient, AttomLookupResult, AttomProperty } from '@deed-shield/core';

type Options = {
  apiKey: string;
  baseUrl?: string;
  timeoutMs?: number;
  paths?: {
    parcel: string;
    address: string;
  };
  fetchImpl?: typeof fetch;
};

const DEFAULT_PATHS = {
  parcel: '/propertyapi/v1.0.0/property/basicprofile',
  address: '/propertyapi/v1.0.0/property/basicprofile'
};

import CircuitBreaker from 'opossum';
import { randomUUID } from 'crypto';

export class HttpAttomClient implements AttomClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly paths: Options['paths'];
  private readonly fetchImpl: typeof fetch;
  private readonly breaker: CircuitBreaker<[string, RequestInit, string], any>;

  constructor(opts: Options) {
    this.apiKey = opts.apiKey;
    this.baseUrl = opts.baseUrl ?? 'https://api.gateway.attomdata.com';
    this.timeoutMs = opts.timeoutMs ?? 7000;
    this.paths = opts.paths ?? DEFAULT_PATHS;
    this.fetchImpl = opts.fetchImpl ?? fetch;

    const requestFunction = async (urlStr: string, init: RequestInit, correlationId: string) => {
      const res = await this.fetchImpl(urlStr, init);
      if (res.status >= 500 || res.status === 429) {
        throw new Error(`ATTOM ${res.status}`);
      }
      if (!res.ok) {
        throw new Error(`ATTOM error ${res.status}`);
      }
      return res.json().catch(() => ({}));
    };

    this.breaker = new CircuitBreaker(requestFunction, {
      timeout: this.timeoutMs,
      errorThresholdPercentage: 50,
      resetTimeout: 30000,
      capacity: 10,
    });

    this.breaker.fallback(() => ({ fallback: true }));

    // Optional: Log breaker events for observability
    this.breaker.on('open', () => console.warn('[AttomClient] Circuit Breaker OPEN'));
    this.breaker.on('halfOpen', () => console.log('[AttomClient] Circuit Breaker HALF-OPEN'));
    this.breaker.on('close', () => console.log('[AttomClient] Circuit Breaker CLOSED'));
  }

  async getByParcel(pin: string): Promise<AttomLookupResult[]> {
    return this.request(this.paths!.parcel, { apn: pin }, 'parcel');
  }

  async getByAddress(address: { line1: string; city: string; state: string; zip?: string | null }): Promise<AttomLookupResult[]> {
    const params: Record<string, string> = {
      address1: address.line1,
      address2: `${address.city}, ${address.state}${address.zip ? ` ${address.zip}` : ''}`
    };
    return this.request(this.paths!.address, params, 'address');
  }

  private async request(
    path: string,
    params: Record<string, string>,
    endpoint: 'parcel' | 'address'
  ): Promise<AttomLookupResult[]> {
    if (!this.apiKey) return [];

    const url = new URL(path, this.baseUrl);
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

    const correlationId = randomUUID();
    const results: AttomLookupResult[] = [];

    try {
      const json = await this.breaker.fire(url.toString(), {
        headers: {
          apikey: this.apiKey,
          accept: 'application/json'
        }
      }, correlationId);

      if (json && json.fallback) {
         console.warn(`[AttomClient] [${correlationId}] Fallback triggered for endpoint: ${endpoint}`);
         return [];
      }

      const properties: any[] = json.property || json.properties || [];
      for (const p of properties) {
        const property = mapProperty(p);
        results.push({
          property,
          endpoint,
          requestId: json.requestId || json.transactionId || correlationId,
          raw: undefined
        });
      }
    } catch (err) {
       console.error(`[AttomClient] [${correlationId}] Request failed: ${endpoint}`, String((err as Error).message || err));
    }

    return results;
  }
}


function mapProperty(p: any): AttomProperty {
  const address = p.address || {};
  const owner = p.owner || p.assessment?.owner || {};
  const owners: string[] = [];
  if (owner.owner1?.fullName) owners.push(owner.owner1.fullName);
  if (owner.owner2?.fullName) owners.push(owner.owner2.fullName);

  const lot = p.lot || p.summary?.lot || {};

  return {
    apn: p.identifier?.apn || p.identifier?.attomId || p.summary?.apn || p.apn,
    altId: p.identifier?.altId || null,
    address: {
      line1: address.line1 || address.oneLine || address.streetLine,
      city: address.city || address.locality || address.countrySecondarySubd,
      state: address.state || address.countrySubd,
      zip: address.postalcode || address.postal1 || address.zipcode
    },
    location: {
      lat: p.location?.latitude || p.geo?.latitude || null,
      lon: p.location?.longitude || p.geo?.longitude || null
    },
    lot: {
      lot: lot.lotNum || lot.lot,
      block: lot.block,
      tract: lot.tract,
      subdivision: lot.subdivision || lot.secLot
    },
    owners,
    assessment: p.assessment
  };
}
