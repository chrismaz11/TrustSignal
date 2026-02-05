
import { describe, it, expect } from 'vitest';
import { extractMetadataFromText, cleanPdfText } from './extraction';

describe('PDF Text Cleaning', () => {
    it('removes watermark phrases', () => {
        const input = "DO NOT COPY This is a deed UNOFFICIAL COPY";
        const output = cleanPdfText(input);
        expect(output.trim()).toBe("This is a deed");
    });

    it('collapses multiple spaces', () => {
        const input = "This   is    spaced   out";
        const output = cleanPdfText(input);
        expect(output.trim()).toBe("This is spaced out");
    });
});

describe('Metadata Extraction', () => {
    it('extracts Cook County PIN with dashes', () => {
        const text = "Property Index Number: 12-34-567-000-0000 located at...";
        const { parcelId } = extractMetadataFromText(text);
        expect(parcelId).toBe("12-34-567-000-0000");
    });

    it('extracts compact PIN', () => {
        const text = "PIN 12345670000000 is the subject property";
        const { parcelId } = extractMetadataFromText(text);
        expect(parcelId).toBe("12345670000000");
    });

    it('extracts PIN from loose format', () => {
        const text = "P.I.N. 12 34 567 000 0000";
        const { parcelId } = extractMetadataFromText(text);
        expect(parcelId).toBe("12-34-567-000-0000");
    });

    it('extracts Grantor from standard deed lead-in', () => {
        const text = "THIS INDENTURE, made this day by and between JOHN DOE of Cook County";
        const { grantor } = extractMetadataFromText(text);
        expect(grantor).toBe("JOHN DOE");
    });

    it('extracts Grantor from specific label', () => {
        const text = "Grantor: JANE SMITH";
        const { grantor } = extractMetadataFromText(text);
        expect(grantor).toBe("JANE SMITH");
    });

    it('extracts Grantor from "Grantor(s)" label', () => {
        const text = "The Grantor(s) ROBERT JOHNSON of Chicago";
        const { grantor } = extractMetadataFromText(text);
        expect(grantor).toBe("ROBERT JOHNSON");
    });

    it('identifies Grantor by social status pattern', () => {
        const text = "MICHAEL JORDAN, a married man";
        const { grantor } = extractMetadataFromText(text);
        expect(grantor).toBe("MICHAEL JORDAN");
    });
});
