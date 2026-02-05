import { Buffer } from 'node:buffer';
import { RiskSignal } from './types.js';

export interface LayoutOptions {
    templateId?: string;
}

/**
 * Checks layout consistency against known good templates.
 */
export async function checkLayoutConsistency(pdfBuffer: Buffer, options: LayoutOptions = {}): Promise<RiskSignal[]> {
    const signals: RiskSignal[] = [];
    const pdfString = pdfBuffer.toString('latin1');

    // 1. Template matching (Mock)
    // If we expect a specific template, checking for key phrases/structure
    if (options.templateId === 'STANDARD_CA') {
        if (!pdfString.includes('CALIFORNIA ALL-PURPOSE ACKNOWLEDGMENT')) {
            signals.push({
                id: 'TEMPLATE_MISMATCH',
                description: 'Document missing required California Notary Block',
                severity: 'HIGH'
            });
        }
    }

    // 2. Field Placement (Mock)
    // Detect if text is suspiciously floating or misaligned (would need OCR/Text extraction in real world)
    if (pdfString.includes('<<<FLOATING_TEXT_LAYER>>>')) {
        signals.push({
            id: 'HIDDEN_LAYER',
            description: 'Document contains hidden text layers',
            severity: 'HIGH'
        });
    }

    return signals;
}
