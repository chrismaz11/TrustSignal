
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
const fs = require('fs');

async function createTestPdf() {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage();
  const { width, height } = page.getSize();
  const fontSize = 30;

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

  page.drawText('Deed Shield Test Deed', {
    x: 50,
    y: height - 4 * fontSize,
    size: fontSize,
    font: font,
    color: rgb(0, 0.53, 0.71),
  });
  
  // Add some text that might be extracted
  page.drawText('Grantor: Alice Smith', { x: 50, y: height - 6 * fontSize, size: 12, font: font });
  page.drawText('Parcel ID: PARCEL-777', { x: 50, y: height - 7 * fontSize, size: 12, font: font });

  const pdfBytes = await pdfDoc.save();
  fs.writeFileSync('test_deed.pdf', pdfBytes);
  console.log('Created test_deed.pdf');
}

createTestPdf();
