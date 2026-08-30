import { showLoader, hideLoader, showAlert } from '../ui.js';
import { downloadFile } from '../utils/helpers.js';
import { state } from '../state.js';
import { PDFName, PDFDict, PDFArray } from 'pdf-lib';

function isChecked(id: string, fallback = true): boolean {
    const el = document.getElementById(id) as HTMLInputElement | null;
    return el ? el.checked : fallback;
}

export async function sanitizePdf() {
    if (!state.pdfDoc) {
        showAlert('Error', 'PDF not loaded.');
        return;
    }

    showLoader('Sanitizing PDF...');
    try {
        const removeJs = isChecked('sanitize-js');
        const removeActions = isChecked('sanitize-actions');
        const removeEmbedded = isChecked('sanitize-embedded');
        const removeMetadata = isChecked('sanitize-metadata');

        const doc = state.pdfDoc;
        const context = doc.context;
        const catalog = doc.catalog;

        // 1. Remove document-level JavaScript and Names/JavaScript tree.
        if (removeJs || removeEmbedded) {
            const names = catalog.lookupMaybe(PDFName.of('Names'), PDFDict);
            if (names) {
                if (removeJs) {
                    names.delete(PDFName.of('JavaScript'));
                }
                if (removeEmbedded) {
                    names.delete(PDFName.of('EmbeddedFiles'));
                }
            }
        }

        // 2. Remove OpenAction and AA (additional actions) that can auto-run scripts.
        if (removeActions) {
            catalog.delete(PDFName.of('OpenAction'));
            catalog.delete(PDFName.of('AA'));

            // Strip per-page and per-annotation actions.
            const pages = doc.getPages();
            for (const page of pages) {
                page.node.delete(PDFName.of('AA'));
                const annots = page.node.lookupMaybe(PDFName.of('Annots'), PDFArray);
                if (annots) {
                    for (let i = 0; i < annots.size(); i++) {
                        const annot = annots.lookupMaybe(i, PDFDict);
                        if (annot) {
                            annot.delete(PDFName.of('A'));
                            annot.delete(PDFName.of('AA'));
                        }
                    }
                }
            }
        }

        // 3. Remove AcroForm-level JavaScript actions.
        if (removeJs) {
            const acroForm = catalog.lookupMaybe(PDFName.of('AcroForm'), PDFDict);
            if (acroForm) {
                acroForm.delete(PDFName.of('AA'));
                acroForm.delete(PDFName.of('XFA'));
            }
        }

        // 4. Strip metadata (info dict + XMP) if requested.
        if (removeMetadata) {
            try {
                const infoDict = doc.getInfoDict();
                infoDict.keys().forEach((key: any) => infoDict.delete(key));
            } catch {
                /* no info dict */
            }
            doc.setTitle('');
            doc.setAuthor('');
            doc.setSubject('');
            doc.setKeywords([]);
            doc.setCreator('');
            doc.setProducer('');
            catalog.delete(PDFName.of('Metadata'));
        }

        const sanitizedBytes = await doc.save();
        downloadFile(new Blob([sanitizedBytes], { type: 'application/pdf' }), 'sanitized.pdf');
    } catch (e) {
        console.error(e);
        showAlert('Error', 'Could not sanitize the PDF.');
    } finally {
        hideLoader();
    }
}
