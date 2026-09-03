// Builds a descriptive filename for a downloaded/viewed lab report PDF,
// e.g. "cbc_panel_2024-01-15_john_doe.pdf" — used for both the
// Content-Disposition header (download/view) and originally exported for
// unit testing directly, independent of the route module.
function generatePdfFilename(testName, testDate, firstName, lastName) {
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toISOString().split('T')[0];
  };

  const sanitizeFilename = (str) => {
    return str.replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_').toLowerCase();
  };

  const testNameClean = sanitizeFilename(testName || 'lab_report');
  const dateFormatted = formatDate(testDate);
  const patientName = sanitizeFilename(`${firstName || ''}_${lastName || ''}`.replace(/^_|_$/g, ''));

  return `${testNameClean}_${dateFormatted}_${patientName || 'unknown'}.pdf`;
}

module.exports = { generatePdfFilename };
