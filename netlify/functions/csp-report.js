// Receives Content-Security-Policy violation reports (report-only phase) and writes
// them to the function logs. Nothing is stored and nothing is returned to the sender.
const MAX_BODY_BYTES = 10_000;

const pickReport = (payload) => {
  const report = payload?.['csp-report'] || payload?.body || payload;

  if (!report || typeof report !== 'object') {
    return null;
  }

  return {
    document: report['document-uri'] || report.documentURL,
    directive: report['effective-directive'] || report['violated-directive'] || report.effectiveDirective,
    blocked: report['blocked-uri'] || report.blockedURL,
    source: report['source-file'] || report.sourceFile,
    line: report['line-number'] || report.lineNumber,
    disposition: report.disposition,
  };
};

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: { Allow: 'POST' }, body: '' };
  }

  const rawBody = String(event.body || '');

  if (rawBody.length > MAX_BODY_BYTES) {
    return { statusCode: 413, body: '' };
  }

  try {
    const parsed = JSON.parse(rawBody);
    const reports = (Array.isArray(parsed) ? parsed : [parsed]).map(pickReport).filter(Boolean);

    reports.forEach((report) => {
      console.warn('[csp-violation]', JSON.stringify(report));
    });
  } catch {
    // Ignore malformed reports.
  }

  return { statusCode: 204, body: '' };
};
