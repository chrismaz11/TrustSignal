import { describe, it, expect, vi } from 'vitest';
import { CookCountyComplianceValidator } from '../../../services/compliance.js';
import OpenAI from 'openai';

vi.mock('openai');
vi.mock('pdf2json');

describe('CookCountyComplianceValidator', () => {
  describe('constructor', () => {
    it('should initialize without OpenAI API key', () => {
      delete process.env.OPENAI_API_KEY;
      const validator = new CookCountyComplianceValidator();
      expect(validator['openai']).toBeNull();
    });

    it('should initialize with OpenAI API key', () => {
      process.env.OPENAI_API_KEY = 'test-key';
      const validator = new CookCountyComplianceValidator();
      expect(validator['openai']).toBeInstanceOf(OpenAI);
    });
  });

  describe('validateDocument', () => {
    it('should return FAIL for empty PDF', async () => {
      const validator = new CookCountyComplianceValidator();
      const result = await validator.validateDocument(Buffer.from(''));
      expect(result.status).toBe('FAIL');
      expect(result.details).toContain('Document appears empty or illegible');
    });

    it('should return FLAGGED without OpenAI API key', async () => {
      delete process.env.OPENAI_API_KEY;
      const validator = new CookCountyComplianceValidator();

      // Mock PDF extraction
      const mockPdfParser = {
        on: vi.fn(),
        parseBuffer: vi.fn(),
        getRawTextContent: vi.fn().mockReturnValue('test content')
      };
      vi.mocked(PDFParser).mockReturnValue(mockPdfParser as any);

      const result = await validator.validateDocument(Buffer.from('test'));
      expect(result.status).toBe('FLAGGED');
      expect(result.details).toContain('OpenAI API Key missing');
    });

    it('should handle PDF extraction error', async () => {
      const validator = new CookCountyComplianceValidator();

      // Mock PDF extraction error
      const mockPdfParser = {
        on: vi.fn((event, callback) => {
          if (event === 'pdfParser_dataError') {
            callback({ parserError: new Error('PDF parse error') });
          }
        }),
        parseBuffer: vi.fn()
      };
      vi.mocked(PDFParser).mockReturnValue(mockPdfParser as any);

      const result = await validator.validateDocument(Buffer.from('test'));
      expect(result.status).toBe('FAIL');
      expect(result.details).toContain('Unable to extract text from document');
    });

    it('should call OpenAI API with valid content', async () => {
      process.env.OPENAI_API_KEY = 'test-key';
      const validator = new CookCountyComplianceValidator();

      // Mock PDF extraction
      const mockPdfParser = {
        on: vi.fn((event, callback) => {
          if (event === 'pdfParser_dataReady') {
            callback();
          }
        }),
        parseBuffer: vi.fn(),
        getRawTextContent: vi.fn().mockReturnValue('test content for validation')
      };
      vi.mocked(PDFParser).mockReturnValue(mockPdfParser as any);

      // Mock OpenAI
      const mockOpenAI = {
        chat: {
          completions: {
            create: vi.fn().mockResolvedValue({
              choices: [{
                message: { content: 'No critical failures detected' }
              }]
            })
          }
        }
      };
      vi.mocked(OpenAI).mockReturnValue(mockOpenAI as any);

      const result = await validator.validateDocument(Buffer.from('test'));
      expect(result.status).toBe('PASS');
    });

    it('should handle OpenAI API error', async () => {
      process.env.OPENAI_API_KEY = 'test-key';
      const validator = new CookCountyComplianceValidator();

      // Mock PDF extraction
      const mockPdfParser = {
        on: vi.fn((event, callback) => {
          if (event === 'pdfParser_dataReady') {
            callback();
          }
        }),
        parseBuffer: vi.fn(),
        getRawTextContent: vi.fn().mockReturnValue('test content')
      };
      vi.mocked(PDFParser).mockReturnValue(mockPdfParser as any);

      // Mock OpenAI error
      const mockOpenAI = {
        chat: {
          completions: {
            create: vi.fn().mockRejectedValue(new Error('API error'))
          }
        }
      };
      vi.mocked(OpenAI).mockReturnValue(mockOpenAI as any);

      const result = await validator.validateDocument(Buffer.from('test'));
      expect(result.status).toBe('FAIL');
      expect(result.details).toContain('LLM Analysis Error');
    });
  });

  describe('parseAnalysis', () => {
    const validator = new CookCountyComplianceValidator();

    it('should parse analysis with critical failures', () => {
      const analysis = `
CRITICAL FAILURE: PIN missing
CRITICAL FAILURE: Legal Description missing
Some other text
`;

      const result = (validator as any).parseAnalysis(analysis);
      expect(result.status).toBe('FAIL');
      expect(result.details).toContain('CRITICAL FAILURE: PIN missing');
      expect(result.details).toContain('CRITICAL FAILURE: Legal Description missing');
      expect(result.checks.pin).toBe(false);
      expect(result.checks.legalDescription).toBe(false);
    });

    it('should parse analysis with no failures', () => {
      const analysis = 'All checks passed. Document is compliant.';

      const result = (validator as any).parseAnalysis(analysis);
      expect(result.status).toBe('PASS');
      expect(result.details).toEqual(['Compliance Check Passed']);
    });

    it('should map all check types', () => {
      const analysis = `
CRITICAL FAILURE: Jurisdiction missing
CRITICAL FAILURE: PIN missing
CRITICAL FAILURE: Legal Description missing
CRITICAL FAILURE: Common Address missing
CRITICAL FAILURE: Mail To missing
CRITICAL FAILURE: Prepared By missing
CRITICAL FAILURE: Formatting missing
`;

      const result = (validator as any).parseAnalysis(analysis);
      expect(result.checks.jurisdiction).toBe(false);
      expect(result.checks.pin).toBe(false);
      expect(result.checks.legalDescription).toBe(false);
      expect(result.checks.commonAddress).toBe(false);
      expect(result.checks.mailTo).toBe(false);
      expect(result.checks.preparedBy).toBe(false);
      expect(result.checks.formatting).toBe(false);
    });
  });

  describe('getEmptyChecks', () => {
    it('should return all checks as false', () => {
      const validator = new CookCountyComplianceValidator();
      const checks = (validator as any).getEmptyChecks();

      expect(checks.jurisdiction).toBe(false);
      expect(checks.pin).toBe(false);
      expect(checks.legalDescription).toBe(false);
      expect(checks.commonAddress).toBe(false);
      expect(checks.mailTo).toBe(false);
      expect(checks.preparedBy).toBe(false);
      expect(checks.formatting).toBe(false);
    });
  });

  describe('extractTextFromPdf', () => {
    it('should extract text from PDF buffer', async () => {
      const validator = new CookCountyComplianceValidator();

      // Mock PDF parser
      const mockPdfParser = {
        on: vi.fn((event, callback) => {
          if (event === 'pdfParser_dataReady') {
            callback();
          }
        }),
        parseBuffer: vi.fn(),
        getRawTextContent: vi.fn().mockReturnValue('extracted text')
      };
      vi.mocked(PDFParser).mockReturnValue(mockPdfParser as any);

      const result = await (validator as any).extractTextFromPdf(Buffer.from('test'));
      expect(result).toBe('extracted text');
    });

    it('should reject on PDF parse error', async () => {
      const validator = new CookCountyComplianceValidator();

      // Mock PDF parser error
      const mockPdfParser = {
        on: vi.fn((event, callback) => {
          if (event === 'pdfParser_dataError') {
            callback({ parserError: new Error('Parse error') });
          }
        }),
        parseBuffer: vi.fn()
      };
      vi.mocked(PDFParser).mockReturnValue(mockPdfParser as any);

      await expect((validator as any).extractTextFromPdf(Buffer.from('test'))).rejects.toThrow('Parse error');
    });
  });
});
