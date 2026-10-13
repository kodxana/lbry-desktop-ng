// A generated one-page PDF. Offsets are calculated so the fixture needs no PDF toolchain.
module.exports = function pdfFixture() {
  const text = 'q 0 1 0 rg 40 40 220 80 re f Q\nBT /F1 18 Tf 40 150 Td (Desktop document fixture) Tj ET';
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 200] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    '<< /Length ' + text.length + ' >>\nstream\n' + text + '\nendstream',
  ];
  let result = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(result.length);
    result += index + 1 + ' 0 obj\n' + object + '\nendobj\n';
  });
  const xref = result.length;
  result += 'xref\n0 6\n0000000000 65535 f \n';
  for (const offset of offsets.slice(1)) result += String(offset).padStart(10, '0') + ' 00000 n \n';
  return result + 'trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n' + xref + '\n%%EOF\n';
};
