import { describe, it, expect } from 'vitest';
import { mapInternalStatusToExternal } from '../../receipts.js';

describe('receipts', () => {
  describe('mapInternalStatusToExternal', () => {
    it('should map ALLOW to clean', () => {
      const result = mapInternalStatusToExternal('ALLOW');
      expect(result).toBe('clean');
    });

    it('should map BLOCK to failure', () => {
      const result = mapInternalStatusToExternal('BLOCK');
      expect(result).toBe('failure');
    });

    it('should map FLAG to compliance_gap', () => {
      const result = mapInternalStatusToExternal('FLAG');
      expect(result).toBe('compliance_gap');
    });

    it('should map any decision to revoked when revoked=true', () => {
      expect(mapInternalStatusToExternal('ALLOW', true)).toBe('revoked');
      expect(mapInternalStatusToExternal('BLOCK', true)).toBe('revoked');
      expect(mapInternalStatusToExternal('FLAG', true)).toBe('revoked');
    });

    it('should handle revoked=false explicitly', () => {
      expect(mapInternalStatusToExternal('ALLOW', false)).toBe('clean');
      expect(mapInternalStatusToExternal('BLOCK', false)).toBe('failure');
      expect(mapInternalStatusToExternal('FLAG', false)).toBe('compliance_gap');
    });

    it('should default revoked to false', () => {
      expect(mapInternalStatusToExternal('ALLOW')).toBe('clean');
      expect(mapInternalStatusToExternal('BLOCK')).toBe('failure');
      expect(mapInternalStatusToExternal('FLAG')).toBe('compliance_gap');
    });
  });
});
