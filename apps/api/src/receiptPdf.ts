import PDFDocument from 'pdfkit';

import { Receipt } from '../../../packages/core/dist/index.js';

export async function renderReceiptPdf(receipt: Receipt): Promise<Buffer> {
  const doc = new PDFDocument({ margin: 48 });
  const chunks: Buffer[] = [];

  return new Promise((resolve, reject) => {
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(18).text('TrustSignal Receipt', { underline: true });
    doc.moveDown();
    doc.fontSize(12);
    doc.text(`Receipt ID: ${receipt.receiptId}`);
    doc.text(`Created At: ${receipt.createdAt}`);
    doc.text(`Policy Profile: ${receipt.policyProfile}`);
    doc.text(`Decision: ${receipt.decision}`);
    doc.text(`Risk Score: ${receipt.riskScore}`);
    doc.moveDown();
    doc.text(`Inputs Commitment: ${receipt.inputsCommitment}`);
    doc.text(`Receipt Hash: ${receipt.receiptHash}`);
    doc.moveDown();

    doc.text('Reasons:', { underline: true });
    receipt.reasons.forEach((reason) => doc.text(`- ${reason}`));
    doc.moveDown();

    doc.text('Checks:', { underline: true });
    receipt.checks.forEach((check) => {
      doc.text(`${check.checkId}: ${check.status}${check.details ? ` (${check.details})` : ''}`);
    });

    doc.end();
  });
}
