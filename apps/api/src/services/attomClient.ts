import { AttomClient, AttomLookupResult, AttomProperty } from '../../../../packages/core/dist/index.js';

type AttomApiProperty = Record<string, unknown>;
type AttomApiResponse = {
  property?: AttomApiProperty[];
  properties?: AttomApiProperty[];
  requestId?: string;
  transactionId?: string;
};

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

        const properties = json.property ?? json.properties ?? [];
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

function mapProperty(p: AttomApiProperty): AttomProperty {
  const record = p as {
    address?: Record<string, unknown>;
    owner?: {
      owner1?: { fullName?: string };
      owner2?: { fullName?: string };
    };
    assessment?: { owner?: { owner1?: { fullName?: string }; owner2?: { fullName?: string } } };
    summary?: Record<string, unknown>;
    lot?: Record<string, unknown>;
    identifier?: Record<string, unknown>;
    apn?: string;
    location?: Record<string, unknown>;
    geo?: Record<string, unknown>;
  };
  const address = record.address ?? {};
  const owner = record.owner ?? record.assessment?.owner ?? {};
  const owners: string[] = [];
  if (owner.owner1?.fullName) owners.push(owner.owner1.fullName);
  if (owner.owner2?.fullName) owners.push(owner.owner2.fullName);

  const lot = record.lot ?? ((record.summary?.lot as Record<string, unknown> | undefined) ?? {});

  return {
    apn: (record.identifier?.apn as string | undefined) || (record.identifier?.attomId as string | undefined) || (record.summary?.apn as string | undefined) || record.apn,
    altId: (record.identifier?.altId as string | undefined) ?? null,
    address: {
      line1: (address.line1 as string | undefined) || (address.oneLine as string | undefined) || (address.streetLine as string | undefined),
      city: (address.city as string | undefined) || (address.locality as string | undefined) || (address.countrySecondarySubd as string | undefined),
      state: (address.state as string | undefined) || (address.countrySubd as string | undefined),
      zip: (address.postalcode as string | undefined) || (address.postal1 as string | undefined) || (address.zipcode as string | undefined)
    },
    location: {
      lat: (record.location?.latitude as number | undefined) || (record.geo?.latitude as number | undefined) || null,
      lon: (record.location?.longitude as number | undefined) || (record.geo?.longitude as number | undefined) || null
    },
    lot: {
      lot: (lot.lotNum as string | undefined) || (lot.lot as string | undefined),
      block: lot.block as string | undefined,
      tract: lot.tract as string | undefined,
      subdivision: (lot.subdivision as string | undefined) || (lot.secLot as string | undefined)
    },
    owners,
    assessment: record.assessment
  };
}
