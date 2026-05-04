import { describe, it, expect, vi } from 'vitest';
import { ensureDatabase } from '../../db.js';
import { PrismaClient } from '@prisma/client';

vi.mock('@prisma/client');

describe('db', () => {
  describe('ensureDatabase', () => {
    it('should execute SQL statements without throwing', async () => {
      const mockPrisma = {
        $executeRawUnsafe: vi.fn().mockResolvedValue(undefined)
      } as unknown as PrismaClient;

      await expect(ensureDatabase(mockPrisma)).resolves.not.toThrow();
      expect(mockPrisma.$executeRawUnsafe).toHaveBeenCalled();
    });

    it('should handle database errors gracefully', async () => {
      const mockPrisma = {
        $executeRawUnsafe: vi.fn().mockRejectedValue(new Error('database error'))
      } as unknown as PrismaClient;

      await expect(ensureDatabase(mockPrisma)).rejects.toThrow('database error');
    });

    it('should execute all required statements', async () => {
      const mockPrisma = {
        $executeRawUnsafe: vi.fn().mockResolvedValue(undefined)
      } as unknown as PrismaClient;

      await ensureDatabase(mockPrisma);
      expect(mockPrisma.$executeRawUnsafe).toHaveBeenCalledTimes(20);
    });
  });
});
