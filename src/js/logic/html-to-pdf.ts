import { showLoader, hideLoader, showAlert } from '../ui.js';
import { downloadFile } from '../utils/helpers.js';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

const PAGE_FORMATS: Record<string, [number, number]> = {
    a4: [210, 297],
    letter: [216, 279],
};

const MARGINS: Record<string, number> = {
    narrow: 10,
    normal: 20,
    wide: 30,
};

function readTextFile(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = reject;
        reader.readAsText(file);
    });
}

/**
 * Extract the inner body markup from a full HTML document string so it can be
 * rendered inside our sandboxed off-screen container. Scripts are stripped so
 * that arbitrary uploaded HTML cannot execute.
 */
function sanitizeHtml(rawHtml: string): string {
    const doc = new DOMParser().parseFromString(rawHtml, 'text/html');
    // Remove any script tags and inline event handlers for safety.
    doc.querySelectorAll('script, noscript').forEach((el) => el.remove());
    doc.querySelectorAll('*').forEach((el) => {
        for (const attr of Array.from(el.attributes)) {
            if (attr.name.toLowerCase().startsWith('on')) {
                el.removeAttribute(attr.name);
            }
        }
    });
    // Preserve <style> from <head> so uploaded stylesheets still apply.
    const headStyles = Array.from(doc.head?.querySelectorAll('style') || [])
        .map((s) => s.outerHTML)
        .join('\n');
    return headStyles + (doc.body ? doc.body.innerHTML : rawHtml);
}

export async function htmlToPdf() {
    const fileInput = document.getElementById('html-file-input') as HTMLInputElement | null;
    let rawHtml = '';

    if (fileInput && fileInput.files && fileInput.files.length > 0) {
        try {
            rawHtml = (await readTextFile(fileInput.files[0])).trim();
        } catch {
            showAlert('Read Error', 'Could not read the selected HTML file.');
            return;
        }
    } else {
        const textarea = document.getElementById('html-input') as HTMLTextAreaElement | null;
        rawHtml = (textarea?.value || '').trim();
    }

    if (!rawHtml) {
        showAlert('Input Required', 'Please paste some HTML or upload an .html file.');
        return;
    }

    showLoader('Rendering HTML to PDF...');

    let tempContainer: HTMLDivElement | null = null;
    try {
        const pageFormat = (document.getElementById('page-format') as HTMLSelectElement | null)?.value || 'a4';
        const orientation = (document.getElementById('orientation') as HTMLSelectElement | null)?.value || 'portrait';
        const marginSize = (document.getElementById('margin-size') as HTMLSelectElement | null)?.value || 'normal';

        tempContainer = document.createElement('div');
        tempContainer.style.cssText = 'position: absolute; top: -9999px; left: -9999px; width: 800px; padding: 40px; background: white; color: black;';
        tempContainer.innerHTML = sanitizeHtml(rawHtml);
        document.body.appendChild(tempContainer);

        // Wait for any images to load so they are captured in the render.
        const images = Array.from(tempContainer.querySelectorAll('img'));
        await Promise.all(
            images.map(
                (img) =>
                    new Promise<void>((resolve) => {
                        if (img.complete) return resolve();
                        img.onload = () => resolve();
                        img.onerror = () => resolve();
                    })
            )
        );

        const canvas = await html2canvas(tempContainer, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });

        const pdf = new jsPDF({ orientation: orientation as any, unit: 'mm', format: pageFormat });
        const format = PAGE_FORMATS[pageFormat] || PAGE_FORMATS.a4;
        const [pageWidth, pageHeight] = orientation === 'landscape' ? [format[1], format[0]] : format;
        const margin = MARGINS[marginSize] ?? MARGINS.normal;
        const contentWidth = pageWidth - margin * 2;
        const contentHeight = pageHeight - margin * 2;
        const imgData = canvas.toDataURL('image/png');
        const imgHeight = (canvas.height * contentWidth) / canvas.width;

        let heightLeft = imgHeight;
        let position = margin;
        pdf.addImage(imgData, 'PNG', margin, position, contentWidth, imgHeight);
        heightLeft -= contentHeight;

        while (heightLeft > 0) {
            position = position - pageHeight;
            pdf.addPage();
            pdf.addImage(imgData, 'PNG', margin, position, contentWidth, imgHeight);
            heightLeft -= contentHeight;
        }

        const pdfBlob = pdf.output('blob');
        downloadFile(pdfBlob, 'html-document.pdf');
    } catch (error) {
        console.error('HTML to PDF conversion error:', error);
        showAlert('Conversion Error', 'Failed to generate PDF from the provided HTML.');
    } finally {
        if (tempContainer && tempContainer.parentNode) {
            tempContainer.parentNode.removeChild(tempContainer);
        }
        hideLoader();
    }
}
