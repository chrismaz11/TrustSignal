
// Cook County PIN: 12-34-567-000-0000 or 12-34-567-000
const pinRegexCook = /\b\d{2}-\d{2}-\d{3}-\d{3}(?:-\d{4})?\b/;
const pinLabelRegex = /(?:P\.I\.N\.|PIN|Property Index Number)[\s:.-]*(\d{2}-\d{2}-\d{3}-\d{3}-\d{4}|\d{14}|\d{2}-\d{2}-\d{3}-\d{3})/i;
const pinLoose = /\b\d{2}[\s.-]?\d{2}[\s.-]?\d{3}[\s.-]?\d{3}[\s.-]?\d{4}\b/; // Loose separators
const pinCompact = /\b\d{14}\b/;

// Grantor strategies
const grantorStrategies = [
    /Grantor(?:\(s\))?[\s:.-]+([A-Z\s,]+?)(?:\s+of|\s*,|\s+whose\b)/i, // "Grantor John Doe of..."
    /Grantor(?:\(s\))?[:\s]+([^\n\r]{3,50})/i, // "Grantor: John Doe"
    /(?:THIS INDENTURE|WITNESSETH|WARRANTY DEED).*?made.*?by\s+(?:and between\s+)?([A-Z\s,]+?)(?:\s+of|\s*,|\s+part(?:y|ies) of the first part)/i, // Standard deed lead-in
    /([A-Z]+(?:\s+[A-Z]+)+),\s*(?:a\s+)?(?:married|single|divorced)?\s*(?:man|woman|person|couple)/i // "JOHN DOE, a single man"
];

export function extractMetadataFromText(text: string) {
    let parcelId =
        text.match(pinLabelRegex)?.[1] ||
        text.match(pinRegexCook)?.[0] ||
        text.match(pinLoose)?.[0] ||
        text.match(pinCompact)?.[0] ||
        '';

    // Cleanup PIN
    if (parcelId) {
        parcelId = parcelId.replace(/[\s.]/g, '-'); // Normalize separators
    }

    let grantor = '';
    for (const strategy of grantorStrategies) {
        const m = text.match(strategy);
        if (m && m[1]) {
            grantor = m[1].trim().replace(/,$/, '').replace(/\s+/g, ' ');
            // Filter out common false positives if the regex caught generic text
            if (grantor.length > 3 && !grantor.toLowerCase().includes('grantor') && !grantor.toLowerCase().includes('indenture')) {
                break;
            }
        }
    }

    return { parcelId, grantor };
}

export function cleanPdfText(text: string): string {
    return text
        .replace(/(DO NOT COPY|UNOFFICIAL COPY|SAMPLE|VOID)/gi, '')
        .replace(/\s+/g, ' ');
}
