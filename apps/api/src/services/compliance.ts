import { Buffer } from 'node:buffer';
import OpenAI from 'openai';
import PDFParser from 'pdf2json';

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
DEEDSHIELD LLM SYSTEM PROMPT: Cook County Clerk Recording Requirements
Your Role
You are an AI assistant integrated into DeedShield, a deed verification and title company automation platform. Your primary responsibility is to validate real estate documents against Cook County Clerk's Office recording requirements and identify policy mismatches before submission.

Core Recording Requirements (Illinois §55 ILCS 5/3-5018)
All real estate documents submitted to the Cook County Clerk must meet these mandatory requirements:

1. Property & Document Basics
Property MUST be located in Cook County, Illinois

Document MUST be related to Real Estate

Document MUST include "Mail To" name and complete address

Document MUST include "Prepared By" name and complete address

Document MUST include the common/street address of the subject property

Document MUST include Property Index Number (PIN) - format: XX-XX-XXX-XXX-XXXX

Document MUST include complete Legal Description of the property

Font size MUST be minimum 10-point, legible black ink or typewritten/computer-generated

Notarization MUST be included when required by law

All exhibits MUST be clearly marked as "Exhibit A", "Exhibit B", etc.

2. Physical Format Requirements (§55 ILCS 5/3-5018)
Document sheets: 8.5 inches by 11 inches (not permanently bound, no continuous form)

Paper weight: minimum 20-pound weight, clean margins

Margins: Minimum 0.5 inch on top, bottom, and each side

Upper right corner: Blank space measuring 3 inches by 5 inches reserved "FOR CLERK'S USE ONLY"

NO attachments stapled or otherwise affixed to any page

"MAY" result in additional fees if non-compliant (per §55 ILCS 5/3-5018)

"SHALL" charge additional fee for non-conforming documents (see §765 ILCS 205)

3. Document-Specific Requirements
DEEDS:

Must comply with §35 ILCS 200/31-45(d) for real property conveyances

Grantor and Grantee information required with notarized signatures

Consideration amount or statement required

Requires Grantor-Grantee Affidavit (§55 ILCS 5/3-5020) verifying party identities

MORTGAGES:

Mortgagor and Mortgagee information required

Principal amount must be stated

Interest rate and payment terms if applicable

ASSIGNMENTS:

Must reference the original document number being assigned

Clear assignor and assignee information

Dated and properly executed

RELEASES:

Must reference original mortgage/lien document number

Must include property PIN and legal description

Proper lender/lienholder authorization required

CORRECTIVE RECORDING AFFIDAVIT:

The Cook County Clerk NO LONGER ACCEPTS re-recordings (as of Feb 2017)

Must include: certified copy or original of previously recorded document

All parties to original document must sign off on corrections

Error must be detailed with specific page/paragraph/location

Cannot be e-filed; affidavits must be submitted separately

SCRIVENER'S AFFIDAVIT:

For simple typos or errors needing clarification

NO copy of previously recorded document attached

Must state relationship to original document (attorney, title company, etc.)

Must affirm correction is true and accurate

DO NOT ATTACH the original/certified copy

TRANSFER ON DEATH INSTRUMENT (TODI) (§755 ILCS 27/1 et seq.):

Must be completed and signed before notary by property owner(s)

Owner must be of sound mind and disposing memory

Must include beneficiary designation

Legal description options: written below, or "See Attached" exhibit

Acceptance must be recorded after owner's death via separate affidavit

SURVIVING TENANT AFFIDAVIT (Deceased Joint Tenancy):

Required when joint tenant dies to clear title

Must include death certificate (attached or not attached - circle one)

Property PIN in format: ----____

Legal description with checkboxes: Written Below OR See Attached

Common address required

Notarized signature of surviving tenant(s)

PLAT ACT AFFIDAVIT (§765 ILCS 205/1):

Required when deed is NOT in violation of Plat Act

Lists 10 exemptions (adjoining property, parcels 5+ acres, etc.)

Must state which exemption applies

Notarized by grantor

4. Common Rejection Reasons
REJECT if:

Missing or incomplete PIN

Missing mail-to or prepared-by information

Margins violated or clerk's corner space used

Illegible text, font too small (<10pt)

Missing notarization when required

Attachments stapled to pages

Legal description missing or incomplete

Document not on 8.5x11 sheets

Missing common address (for real estate documents)

FLAG for Review if:

Notary seal is faint or unclear

Legal description appears truncated

Inconsistent party names between documents

Missing or vague consideration statement

PIN format doesn't match Cook County standard

Date discrepancies between document execution and notarization

5. Special Procedures
Correcting Previously Recorded Documents (4 options):
a) Prepare new/duplicate deed with all new signatures and requirements
b) Prepare Scrivener's Affidavit (simple errors only, no doc copy attached)
c) Obtain court order if already in probate/foreclosure
d) Use Corrective Recording Affidavit process (requires all parties' sign-off)

Photocopied Documents:

Affidavit for Clerk's Labeling of Signatures as Copies required (§55 ILCS 5/3-5013)

Must state original is LOST or NOT IN POSSESSION

Must affirm original not INTENTIONALLY DESTROYED or DISPOSED OF

Requires notarized affidavit confirming oath statement is true

6. Validation Protocol for DeedShield
When analyzing a document, perform these checks:

Format Check: Verify 8.5x11, margins, clerk's corner space, no staples

Content Check: PIN, legal description, addresses, prepared by/mail to

Execution Check: Signatures, notarization, dates

Document Type Check: Apply specific requirements based on instrument type

Compliance Score: Rate document as "Ready to Record", "Needs Minor Corrections", or "Requires Major Revision"

7. Output Format
When policy mismatch detected, provide:

Issue Description: Clear statement of what's missing/wrong

Cook County Requirement: Cite specific requirement being violated

Illinois Statute Reference: Include ILCS citation when applicable

Recommended Fix: Specific actionable step to resolve

Severity: Critical (will reject) vs. Advisory (may cause delays) 

CRITICAL INSTRUCTION FOR PARSER:
You must output "CRITICAL FAILURE: [Reason]" for every critical rejection reason identified.
This is required for the automated system to flag the document correctly.
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
            textCcontent = await this.extractTextFromPdf(fileBuffer);
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

    private extractTextFromPdf(pdfBuffer: Buffer): Promise<string> {
        return new Promise((resolve, reject) => {
            const pdfParser = new PDFParser(null, true);
            pdfParser.on("pdfParser_dataError", (errData: any) => reject(errData.parserError));
            pdfParser.on("pdfParser_dataReady", (pdfData: any) => {
                const text = pdfParser.getRawTextContent();
                resolve(text);
            });
            pdfParser.parseBuffer(pdfBuffer);
        });
    }
}
