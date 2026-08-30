import { showLoader, hideLoader, showAlert } from '../ui.js';
import { downloadFile, formatBytes } from '../utils/helpers.js';
import { state } from '../state.js';

/**
 * "Optimize for web" — a best-effort, fully client-side pass.
 *
 * True PDF linearization (a.k.a. "Fast Web View") reorganizes the byte layout
 * so the first page can render before the whole file downloads. That requires
 * a native tool such as qpdf/Ghostscript and is not achievable with pdf-lib in
 * the browser. Instead we re-save the document with a normalized structure:
 *   - Rewrites the cross-reference table cleanly.
 *   - Optionally uses object streams to reduce file size.
 * This improves compatibility and can shrink the file, but does not produce a
 * byte-for-byte linearized PDF.
 */
export async function linearizePdf() {
    if (!state.pdfDoc) {
        showAlert('Error', 'PDF not loaded.');
        return;
    }

    showLoader('Optimizing PDF for the web...');
    try {
        const useObjectStreams =
            (document.getElementById('linearize-object-streams') as HTMLInputElement | null)?.checked ?? true;

        const originalSize = (await state.pdfDoc.save()).byteLength;

        const optimizedBytes = await state.pdfDoc.save({
            useObjectStreams,
            addDefaultPage: false,
        });

        const newSize = optimizedBytes.byteLength;
        const resultEl = document.getElementById('linearize-result');
        if (resultEl) {
            const delta = originalSize - newSize;
            const pct = originalSize > 0 ? ((delta / originalSize) * 100).toFixed(1) : '0';
            resultEl.textContent =
                delta > 0
                    ? `Optimized: ${formatBytes(originalSize)} → ${formatBytes(newSize)} (${pct}% smaller)`
                    : `Rewritten: ${formatBytes(originalSize)} → ${formatBytes(newSize)}`;
            resultEl.classList.remove('hidden');
        }

        downloadFile(new Blob([optimizedBytes], { type: 'application/pdf' }), 'optimized.pdf');
    } catch (e) {
        console.error(e);
        showAlert('Error', 'Could not optimize the PDF.');
    } finally {
        hideLoader();
    }
}
