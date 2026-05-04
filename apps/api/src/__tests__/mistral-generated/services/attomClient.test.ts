import { describe, it, expect, vi } from 'vitest';
import { HttpAttomClient } from '../../../services/attomClient.js';

describe('HttpAttomClient', () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    mockFetch.mockClear();
  });

  describe('constructor', () => {
    it('should use default base URL', () => {
      const client = new HttpAttomClient({ apiKey: 'test-key' });
      expect(client['baseUrl']).toBe('https://api.gateway.attomdata.com');
    });

    it('should use custom base URL', () => {
      const client = new HttpAttomClient({ apiKey: 'test-key', baseUrl: 'https://custom.example.com' });
      expect(client['baseUrl']).toBe('https://custom.example.com');
    });

    it('should use custom fetch implementation', () => {
      const client = new HttpAttomClient({ apiKey: 'test-key', fetchImpl: mockFetch });
      expect(client['fetchImpl']).toBe(mockFetch);
    });
  });

  describe('getByParcel', () => {
    it('should return empty array without API key', async () => {
      const client = new HttpAttomClient({ apiKey: '' });
      const result = await client.getByParcel('12345');
      expect(result).toEqual([]);
    });

    it('should make request with parcel ID', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ property: [{}] })
      });

      const client = new HttpAttomClient({ apiKey: 'test-key', fetchImpl: mockFetch });
      await client.getByParcel('12345');

      expect(mockFetch).toHaveBeenCalled();
      const call = mockFetch.mock.calls[0];
      expect(call[0]).toContain('apn=12345');
      expect(call[1]?.headers?.apikey).toBe('test-key');
    });

    it('should handle successful response', async () => {
      const mockProperty = {
        identifier: { apn: '12345' },
        address: { line1: '123 Main St', city: 'Chicago', state: 'IL', postalcode: '60601' },
        owner: { owner1: { fullName: 'John Doe' } }
      };

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ property: [mockProperty] })
      });

      const client = new HttpAttomClient({ apiKey: 'test-key', fetchImpl: mockFetch });
      const result = await client.getByParcel('12345');

      expect(result.length).toBe(1);
      expect(result[0].property.apn).toBe('12345');
      expect(result[0].property.address.line1).toBe('123 Main St');
    });

    it('should handle 500 error with retry', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          json: () => Promise.resolve({})
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ property: [{}] })
        });

      const client = new HttpAttomClient({ apiKey: 'test-key', fetchImpl: mockFetch });
      const result = await client.getByParcel('12345');

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(result.length).toBe(1);
    });

    it('should handle timeout', async () => {
      mockFetch.mockRejectedValue(new Error('timeout'));

      const client = new HttpAttomClient({ apiKey: 'test-key', fetchImpl: mockFetch, timeoutMs: 10 });
      const result = await client.getByParcel('12345');

      expect(result).toEqual([]);
    });
  });

  describe('getByAddress', () => {
    it('should make request with address', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ property: [{}] })
      });

      const client = new HttpAttomClient({ apiKey: 'test-key', fetchImpl: mockFetch });
      await client.getByAddress({ line1: '123 Main St', city: 'Chicago', state: 'IL', zip: '60601' });

      expect(mockFetch).toHaveBeenCalled();
      const call = mockFetch.mock.calls[0];
      expect(call[0]).toContain('address1=123+Main+St');
      expect(call[0]).toContain('address2=Chicago%2C+IL+60601');
    });

    it('should handle address without zip', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ property: [{}] })
      });

      const client = new HttpAttomClient({ apiKey: 'test-key', fetchImpl: mockFetch });
      await client.getByAddress({ line1: '123 Main St', city: 'Chicago', state: 'IL' });

      expect(mockFetch).toHaveBeenCalled();
      const call = mockFetch.mock.calls[0];
      expect(call[0]).toContain('address2=Chicago%2C+IL');
    });
  });

  describe('mapProperty', () => {
    it('should map property with full data', () => {
      const input = {
        identifier: { apn: '12345', altId: 'ALT123' },
        address: { line1: '123 Main St', city: 'Chicago', state: 'IL', postalcode: '60601' },
        location: { latitude: 41.8781, longitude: -87.6298 },
        lot: { lotNum: '1', block: 'A', tract: '123', subdivision: 'Subdiv' },
        owner: { owner1: { fullName: 'John Doe' }, owner2: { fullName: 'Jane Doe' } },
        assessment: { value: 100000 }
      };

      const client = new HttpAttomClient({ apiKey: 'test-key' });
      const result = (client as any).mapProperty(input);

      expect(result.apn).toBe('12345');
      expect(result.altId).toBe('ALT123');
      expect(result.address.line1).toBe('123 Main St');
      expect(result.address.city).toBe('Chicago');
      expect(result.address.state).toBe('IL');
      expect(result.address.zip).toBe('60601');
      expect(result.location.lat).toBe(41.8781);
      expect(result.location.lon).toBe(-87.6298);
      expect(result.lot.lot).toBe('1');
      expect(result.lot.block).toBe('A');
      expect(result.lot.tract).toBe('123');
      expect(result.lot.subdivision).toBe('Subdiv');
      expect(result.owners).toEqual(['John Doe', 'Jane Doe']);
      expect(result.assessment).toEqual({ value: 100000 });
    });

    it('should map property with minimal data', () => {
      const input = {
        identifier: { apn: '12345' },
        address: { line1: '123 Main St' },
        owner: {}
      };

      const client = new HttpAttomClient({ apiKey: 'test-key' });
      const result = (client as any).mapProperty(input);

      expect(result.apn).toBe('12345');
      expect(result.address.line1).toBe('123 Main St');
      expect(result.owners).toEqual([]);
    });

    it('should handle missing fields', () => {
      const input = {};

      const client = new HttpAttomClient({ apiKey: 'test-key' });
      const result = (client as any).mapProperty(input);

      expect(result.apn).toBeUndefined();
      expect(result.address.line1).toBeUndefined();
      expect(result.owners).toEqual([]);
    });

    it('should use fallback fields', () => {
      const input = {
        summary: { apn: 'FALLBACK-APN' },
        address: { oneLine: '123 Main St, Chicago, IL 60601' },
        geo: { latitude: 41.8781, longitude: -87.6298 }
      };

      const client = new HttpAttomClient({ apiKey: 'test-key' });
      const result = (client as any).mapProperty(input);

      expect(result.apn).toBe('FALLBACK-APN');
      expect(result.address.line1).toBe('123 Main St, Chicago, IL 60601');
      expect(result.location.lat).toBe(41.8781);
      expect(result.location.lon).toBe(-87.6298);
    });
  });

  describe('retry logic', () => {
    it('should retry on 500 error', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          json: () => Promise.resolve({})
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ property: [{}] })
        });

      const client = new HttpAttomClient({ apiKey: 'test-key', fetchImpl: mockFetch });
      await client.getByParcel('12345');

      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should retry on 429 error', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          json: () => Promise.resolve({})
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ property: [{}] })
        });

      const client = new HttpAttomClient({ apiKey: 'test-key', fetchImpl: mockFetch });
      await client.getByParcel('12345');

      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should not retry on 400 error', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        json: () => Promise.resolve({})
      });

      const client = new HttpAttomClient({ apiKey: 'test-key', fetchImpl: mockFetch });
      await client.getByParcel('12345');

      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should give up after 3 attempts', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.resolve({})
      });

      const client = new HttpAttomClient({ apiKey: 'test-key', fetchImpl: mockFetch });
      await client.getByParcel('12345');

      expect(mockFetch).toHaveBeenCalledTimes(3);
    });
  });

  describe('error handling', () => {
    it('should log warning when no results', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.resolve({})
      });

      const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const client = new HttpAttomClient({ apiKey: 'test-key', fetchImpl: mockFetch });
      await client.getByParcel('12345');

      expect(consoleWarn).toHaveBeenCalled();
      consoleWarn.mockRestore();
    });

    it('should handle JSON parse error', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.reject(new Error('JSON parse error'))
      });

      const client = new HttpAttomClient({ apiKey: 'test-key', fetchImpl: mockFetch });
      const result = await client.getByParcel('12345');

      expect(result).toEqual([]);
    });
  });
});
