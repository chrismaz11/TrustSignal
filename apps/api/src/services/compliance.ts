import { Buffer } from 'node:buffer';
import OpenAI from 'openai';
// @ts-ignore
import pdf from 'pdf-parse';

export interface ComplianceCheckResult {
    status: 'PASS' | 'FAIL' | 'FLAGGED';
    checks: {
        dataset: 'COOK_COUNTY_RECORDING_STANDARDS';
        jurisdiction: boolean;
        pin: boolean;
        legalDescription: boolean;
        commonAddress: boolean;
        mailTo: boolean;
        preparedBy: boolean;
        formatting: boolean; // font size, exhibits, notary
    };
    details: string[];
    rawAnalysis?: string;
}

const COOK_COUNTY_SYSTEM_PROMPT = `
Role: You are the Cook County Compliance Validator for Deed Shield. Your objective is to perform a zero-trust audit of real estate documents against the Cook County Clerk’s mandatory recording requirements to prevent rejections.

Mandatory Validation Logic:
For every document reviewed, you must verify the presence and correctness of the following fields:

1. Geographic Jurisdiction: The property must be explicitly located within Cook County, Illinois.
2. Property Identification:
* PIN: Must include the 14-digit Property Index Number.
* Legal Description: Must include a full, formal legal description (Lot/Block/Subdivision).
* Common Address: Must include the full street address of the subject property.

3. Required Headers/Metadata:
* "Mail To": Must include a valid name and return address.
* "Prepared By": Must include the name and address of the individual who prepared the document.

4. Formatting & Legibility:
* Font Size: Minimum 10pt font across all text.
* Exhibits: Every exhibit must be clearly labeled as an "Exhibit" (e.g., "Exhibit A").
* Notarization: Flag as "Incomplete" if a signature block lacks a valid Notary Public seal/acknowledgment section.

Operational Protocol:
* Adversarial Review: Assume the document will be rejected if any field is missing or illegible.
* Direct Feedback: Do not use marketing language. If a requirement is missing, state: "CRITICAL FAILURE: [Requirement Name] missing."
* Exception Handling: If the document is flagged as "Non-Real Estate," bypass PIN and Legal Description requirements, but still enforce legibility and "Prepared By" headers.

Implementation Notes:
* Auditability: Ensure the software logs which specific check failed so the user can correct it before a costly filing rejection.
* Measurable Outcome: The goal is a 0% rejection rate from the Cook County Clerk’s office.
* Compliance Risk: Flag documents that use "boilerplate" legal descriptions without a specific PIN, as these are high-risk for misclassification.
`;

export class CookCountyComplianceValidator {
    private openai: OpenAI | null = null;

    constructor() {
        if (process.env.OPENAI_API_KEY) {
            this.openai = new OpenAI({
                apiKey: process.env.OPENAI_API_KEY,
            });
        } else {
            console.warn('[CookCountyComplianceValidator] OPENAI_API_KEY not found. Validation checks will differ.');
        }
    }

    async validateDocument(fileBuffer: Buffer): Promise<ComplianceCheckResult> {
        console.log('[CookCountyComplianceValidator] Starting compliance validation...');

        let textCcontent = '';
        try {
            // @ts-ignore
            const data = await pdf(fileBuffer);
            textCcontent = data.text;
        } catch (err) {
            console.error('[CookCountyComplianceValidator] PDF extraction failed:', err);
            return {
                status: 'FAIL',
                checks: this.getEmptyChecks(),
                details: ['CRITICAL FAILURE: Unable to extract text from document for validation.'],
            };
        }

        if (!textCcontent || textCcontent.trim().length === 0) {
            return {
                status: 'FAIL',
                checks: this.getEmptyChecks(),
                details: ['CRITICAL FAILURE: Document appears empty or illegible (no text extracted).']
            };
        }

        if (!this.openai) {
            return {
                status: 'FLAGGED',
                checks: this.getEmptyChecks(),
                details: ['SKIPPED: OpenAI API Key missing. Compliance validation bypassed.'],
            };
        }

        try {
            const completion = await this.openai.chat.completions.create({
                model: 'gpt-4-turbo-preview', // Or appropriate model
                messages: [
                    { role: 'system', content: COOK_COUNTY_SYSTEM_PROMPT },
                    { role: 'user', content: `Analyze the following document text for compliance:\n\n${textCcontent.substring(0, 15000)}` }, // Truncate if too long, though gpt-4-turbo has large context
                ],
                temperature: 0, // Strict, deterministic
            });

            const analysis = completion.choices[0]?.message?.content || '';
            return this.parseAnalysis(analysis);

        } catch (err) {
            console.error('[CookCountyComplianceValidator] LLM Analysis failed:', err);
            return {
                status: 'FAIL',
                checks: this.getEmptyChecks(),
                details: [`LLM Analysis Error: ${err instanceof Error ? err.message : 'Unknown error'}`],
            };
        }
    }

    private parseAnalysis(analysis: string): ComplianceCheckResult {
        // Basic heuristic parsing of the LLM output based on the prompt's instructions
        // The prompt asks to state "CRITICAL FAILURE: [Requirement Name] missing"

        const failures: string[] = [];
        const lines = analysis.split('\n');

        for (const line of lines) {
            if (line.includes('CRITICAL FAILURE')) {
                failures.push(line.trim());
            }
        }

        const checks = {
            dataset: 'COOK_COUNTY_RECORDING_STANDARDS' as const,
            jurisdiction: !analysis.includes('Geographic Jurisdiction missing'),
            pin: !analysis.includes('PIN missing'),
            legalDescription: !analysis.includes('Legal Description missing'),
            commonAddress: !analysis.includes('Common Address missing'),
            mailTo: !analysis.includes('Mail To missing'),
            preparedBy: !analysis.includes('Prepared By missing'),
            formatting: !analysis.includes('Font Size') && !analysis.includes('Legibility') && !analysis.includes('Notarization'),
        };

        // Refine check mapping based on failures
        if (failures.some(f => f.includes('Jurisdiction'))) checks.jurisdiction = false;
        if (failures.some(f => f.includes('PIN'))) checks.pin = false;
        if (failures.some(f => f.includes('Legal Description'))) checks.legalDescription = false;
        if (failures.some(f => f.includes('Common Address'))) checks.commonAddress = false;
        if (failures.some(f => f.includes('Mail To'))) checks.mailTo = false;
        if (failures.some(f => f.includes('Prepared By'))) checks.preparedBy = false;
        if (failures.some(f => f.includes('Formatting') || f.includes('Font') || f.includes('Exhibit') || f.includes('Notarization') || f.includes('Incomplete'))) checks.formatting = false;

        const status = failures.length > 0 ? 'FAIL' : 'PASS';

        return {
            status,
            checks,
            details: failures.length > 0 ? failures : ['Compliance Check Passed'],
            rawAnalysis: analysis,
        };
    }

    private getEmptyChecks() {
        return {
            dataset: 'COOK_COUNTY_RECORDING_STANDARDS' as const,
            jurisdiction: false,
            pin: false,
            legalDescription: false,
            commonAddress: false,
            mailTo: false,
            preparedBy: false,
            formatting: false
        };
    }
}
