import { AttomClient, AttomLookupResult, AttomProperty } from '../../../../packages/core/dist/index.js';

type AttomApiResponse = {
  property?: unknown[];
  properties?: unknown[];
  requestId?: string;
  transactionId?: string;
};

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : {};
}

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

export class HttpAttomClient implements AttomClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly paths: Options['paths'];
  private readonly fetchImpl: typeof fetch;

  constructor(opts: Options) {
    this.apiKey = opts.apiKey;
    this.baseUrl = opts.baseUrl ?? 'https://api.gateway.attomdata.com';
    this.timeoutMs = opts.timeoutMs ?? 7000;
    this.paths = opts.paths ?? DEFAULT_PATHS;
    this.fetchImpl = opts.fetchImpl ?? fetch;
  }

  async getByParcel(pin: string): Promise<AttomLookupResult[]> {
    return this.request(this.paths!.parcel, { apn: pin }, 'parcel');
  }

  async getByAddress(address: { line1: string; city: string; state: string; zip?: string | null }): Promise<AttomLookupResult[]> {
    // Per ATTOM docs, split into address1 + address2 (city, state, zip)
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

    const results: AttomLookupResult[] = [];
    let lastError: unknown;
    for (let attempt = 0; attempt < 3; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);
      try {
        const res = await this.fetchImpl(url.toString(), {
          headers: {
            apikey: this.apiKey,
            accept: 'application/json'
          },
          signal: controller.signal
        });

        const json = (await res.json().catch(() => ({}))) as AttomApiResponse;

        if (res.status >= 500 || res.status === 429) {
          lastError = new Error(`ATTOM ${res.status}`);
          await new Promise((r) => setTimeout(r, 200 * Math.pow(2, attempt)));
          continue;
        }
        if (!res.ok) {
          lastError = new Error(`ATTOM error ${res.status}`);
          break;
        }

        const properties = (json.property || json.properties || []) as unknown[];
        for (const p of properties) {
          const property = mapProperty(p);
          results.push({
            property,
            endpoint,
            requestId: json.requestId || json.transactionId,
            raw: undefined
          });
        }
        break;
      } catch (err) {
        lastError = err;
        await new Promise((r) => setTimeout(r, 200 * Math.pow(2, attempt)));
      } finally {
        clearTimeout(timer);
      }
    }

    if (!results.length && lastError) {
      console.warn('[AttomClient] No ATTOM result', endpoint, String((lastError as Error).message || lastError));
    }
    return results;
  }
}

function mapProperty(value: unknown): AttomProperty {
  const p = asRecord(value);
  const address = asRecord(p.address);
  const assessment = asRecord(p.assessment);
  const owner = asRecord(p.owner || asRecord(assessment.owner));
  const owners: string[] = [];
  const owner1 = asRecord(owner.owner1);
  const owner2 = asRecord(owner.owner2);
  if (typeof owner1.fullName === 'string') owners.push(owner1.fullName);
  if (typeof owner2.fullName === 'string') owners.push(owner2.fullName);

  const summary = asRecord(p.summary);
  const lot = asRecord(p.lot || asRecord(summary.lot));
  const identifier = asRecord(p.identifier);
  const location = asRecord(p.location);
  const geo = asRecord(p.geo);

  return {
    apn:
      (typeof identifier.apn === 'string' && identifier.apn) ||
      (typeof identifier.attomId === 'string' && identifier.attomId) ||
      (typeof summary.apn === 'string' && summary.apn) ||
      (typeof p.apn === 'string' && p.apn) ||
      undefined,
    altId: typeof identifier.altId === 'string' ? identifier.altId : null,
    address: {
      line1:
        (typeof address.line1 === 'string' && address.line1) ||
        (typeof address.oneLine === 'string' && address.oneLine) ||
        (typeof address.streetLine === 'string' && address.streetLine) ||
        undefined,
      city:
        (typeof address.city === 'string' && address.city) ||
        (typeof address.locality === 'string' && address.locality) ||
        (typeof address.countrySecondarySubd === 'string' && address.countrySecondarySubd) ||
        undefined,
      state:
        (typeof address.state === 'string' && address.state) ||
        (typeof address.countrySubd === 'string' && address.countrySubd) ||
        undefined,
      zip:
        (typeof address.postalcode === 'string' && address.postalcode) ||
        (typeof address.postal1 === 'string' && address.postal1) ||
        (typeof address.zipcode === 'string' && address.zipcode) ||
        undefined
    },
    location: {
      lat:
        (typeof location.latitude === 'number' && location.latitude) ||
        (typeof geo.latitude === 'number' && geo.latitude) ||
        null,
      lon:
        (typeof location.longitude === 'number' && location.longitude) ||
        (typeof geo.longitude === 'number' && geo.longitude) ||
        null
    },
    lot: {
      lot:
        (typeof lot.lotNum === 'string' && lot.lotNum) ||
        (typeof lot.lot === 'string' && lot.lot) ||
        undefined,
      block: typeof lot.block === 'string' ? lot.block : undefined,
      tract: typeof lot.tract === 'string' ? lot.tract : undefined,
      subdivision:
        (typeof lot.subdivision === 'string' && lot.subdivision) ||
        (typeof lot.secLot === 'string' && lot.secLot) ||
        undefined
    },
    owners,
    assessment
  };
}
