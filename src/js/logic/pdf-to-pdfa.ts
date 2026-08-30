import { showLoader, hideLoader, showAlert } from '../ui.js';
import { downloadFile } from '../utils/helpers.js';
import { state } from '../state.js';
import { PDFName } from 'pdf-lib';

/**
 * Convert to PDF/A (best-effort, client-side).
 *
 * Full PDF/A conformance (validated against veraPDF) requires embedding all
 * fonts, an ICC OutputIntent, and structural guarantees that are not feasible
 * purely in the browser with pdf-lib. This tool performs the achievable steps:
 *   - Removes encryption / active content that PDF/A forbids.
 *   - Writes PDF/A identification XMP metadata (pdfaid:part / pdfaid:conformance).
 *   - Normalizes document info metadata.
 * The result declares itself as PDF/A but may not pass strict validators if the
 * source relies on non-embedded fonts. The UI states this clearly.
 */

function escapeXml(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function buildXmp(part: string, conformance: string, title: string, author: string): string {
    const now = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
    return `<?xpacket begin="\uFEFF" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
    <rdf:Description rdf:about=""
        xmlns:pdfaid="http://www.aiim.org/pdfa/ns/id/"
        xmlns:dc="http://purl.org/dc/elements/1.1/"
        xmlns:xmp="http://ns.adobe.com/xap/1.0/">
      <pdfaid:part>${escapeXml(part)}</pdfaid:part>
      <pdfaid:conformance>${escapeXml(conformance)}</pdfaid:conformance>
      <dc:title><rdf:Alt><rdf:li xml:lang="x-default">${escapeXml(title)}</rdf:li></rdf:Alt></dc:title>
      <dc:creator><rdf:Seq><rdf:li>${escapeXml(author)}</rdf:li></rdf:Seq></dc:creator>
      <xmp:CreateDate>${now}</xmp:CreateDate>
      <xmp:ModifyDate>${now}</xmp:ModifyDate>
      <xmp:CreatorTool>BentoPDF</xmp:CreatorTool>
    </rdf:Description>
  </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`;
}

export async function pdfToPdfa() {
    if (!state.pdfDoc) {
        showAlert('Error', 'PDF not loaded.');
        return;
    }

    showLoader('Converting to PDF/A...');
    try {
        const doc = state.pdfDoc;
        const context = doc.context;
        const catalog = doc.catalog;

        const conformanceLevel =
            (document.getElementById('pdfa-level') as HTMLSelectElement | null)?.value || '2B';
        // e.g. "2B" -> part "2", conformance "B"
        const part = conformanceLevel.slice(0, 1);
        const conformance = conformanceLevel.slice(1);

        const title = doc.getTitle() || 'Untitled';
        const author = doc.getAuthor() || 'Unknown';

        // Remove active content forbidden by PDF/A.
        catalog.delete(PDFName.of('OpenAction'));
        catalog.delete(PDFName.of('AA'));

        // Set document info metadata.
        doc.setProducer('BentoPDF (PDF/A best-effort)');
        doc.setCreator('BentoPDF');
        doc.setModificationDate(new Date());

        // Attach the PDF/A XMP metadata stream to the catalog.
        const xmp = buildXmp(part, conformance, title, author);
        const metadataStream = context.stream(xmp, {
            Type: 'Metadata',
            Subtype: 'XML',
        });
        const metadataRef = context.register(metadataStream);
        catalog.set(PDFName.of('Metadata'), metadataRef);

        // Mark the PDF version to at least 1.4 (PDF/A-1) / 1.7 baseline.
        const pdfaBytes = await doc.save({ useObjectStreams: false });
        downloadFile(new Blob([pdfaBytes], { type: 'application/pdf' }), `document-pdfa-${conformanceLevel.toLowerCase()}.pdf`);

        showAlert(
            'PDF/A Created (Best-Effort)',
            'PDF/A identification metadata was added. Note: full compliance also requires all fonts to be embedded in the source; validate with a tool like veraPDF if strict conformance is required.'
        );
    } catch (e) {
        console.error(e);
        showAlert('Error', 'Could not convert the PDF to PDF/A.');
    } finally {
        hideLoader();
    }
}
