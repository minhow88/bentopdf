import { showLoader, hideLoader, showAlert } from '../ui.js';
import { downloadFile, readFileAsArrayBuffer } from '../utils/helpers.js';
import { state } from '../state.js';

import { PDFDocument as PDFLibDocument, rgb, StandardFonts } from 'pdf-lib';

// A4 dimensions in points (72 points per inch)
const A4_WIDTH = 595.28;
const A4_HEIGHT = 841.89;

// Cross-out line settings
const CROSS_LINE_SIZE = 50; // size of the X cross-out area at the corner
const CROSS_LINE_WIDTH = 1;
const CROSS_COLOR = rgb(0, 0, 0);

// Margins and spacing
const PAGE_MARGIN = 40;
const IMAGE_GAP = 30; // gap between front and back images

/**
 * Converts any image into a standard, web-friendly JPEG via canvas.
 */
function sanitizeImageAsJpeg(imageBytes: Uint8Array): Promise<Uint8Array> {
    return new Promise((resolve, reject) => {
        const blob = new Blob([imageBytes as any]);
        const imageUrl = URL.createObjectURL(blob);
        const img = new Image();

        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0);
            canvas.toBlob(
                async (jpegBlob) => {
                    if (!jpegBlob) return reject(new Error('Canvas to JPEG conversion failed.'));
                    resolve(new Uint8Array(await jpegBlob.arrayBuffer()));
                }, 'image/jpeg', 0.92
            );
            URL.revokeObjectURL(imageUrl);
        };
        img.onerror = () => {
            URL.revokeObjectURL(imageUrl);
            reject(new Error('File could not be loaded as an image.'));
        };
        img.src = imageUrl;
    });
}

/**
 * Embeds an image file into the PDF document, handling various formats.
 */
async function embedImage(pdfDoc: any, file: File) {
    const fileBuffer = await readFileAsArrayBuffer(file);

    if (file.type === 'image/jpeg') {
        try {
            return await pdfDoc.embedJpg(fileBuffer as Uint8Array);
        } catch {
            const sanitized = await sanitizeImageAsJpeg(fileBuffer as Uint8Array);
            return await pdfDoc.embedJpg(sanitized);
        }
    } else if (file.type === 'image/png') {
        try {
            return await pdfDoc.embedPng(fileBuffer as Uint8Array);
        } catch {
            // Fall back to JPEG conversion for problematic PNGs
            const sanitized = await sanitizeImageAsJpeg(fileBuffer as Uint8Array);
            return await pdfDoc.embedJpg(sanitized);
        }
    } else {
        // For WebP, HEIC, etc., convert via canvas to JPEG
        const sanitized = await sanitizeImageAsJpeg(fileBuffer as Uint8Array);
        return await pdfDoc.embedJpg(sanitized);
    }
}

/**
 * Draws a diagonal cross-out "X" at the top-left corner of an image area,
 * with the user's text written diagonally across it.
 * This is the Malaysian "Salinan Sah" (Certified True Copy) style.
 */
function drawCornerCrossOut(page: any, x: number, y: number, width: number, height: number, font: any, text: string) {
    // The cross-out X is drawn at the top-left corner of the image
    // Two diagonal lines forming an X
    const crossSize = CROSS_LINE_SIZE;

    // Line 1: top-left to bottom-right of the cross area (\ shape)
    page.drawLine({
        start: { x: x, y: y + height },
        end: { x: x + crossSize, y: y + height - crossSize },
        thickness: CROSS_LINE_WIDTH,
        color: CROSS_COLOR,
    });

    // Line 2: bottom-left to top-right of the cross area (/ shape)
    page.drawLine({
        start: { x: x, y: y + height - crossSize },
        end: { x: x + crossSize, y: y + height },
        thickness: CROSS_LINE_WIDTH,
        color: CROSS_COLOR,
    });

    // Draw the user text diagonally across the cross-out area
    if (text.trim()) {
        const fontSize = 8;
        page.drawText(text, {
            x: x + crossSize + 6,
            y: y + height - (crossSize / 2) - (fontSize / 2),
            font,
            size: fontSize,
            color: rgb(0.2, 0.2, 0.2),
        });
    }
}

/**
 * Setup function: wires up UI event listeners after the template renders.
 */
export function setupIdCardUI() {
    // Nothing special needed on initial load — text input is always visible.
    // The process button gets wired in fileHandler.
}

/**
 * Main process function: generates the A4 PDF with front/back IC images + corner marks + text.
 */
export async function idCardToPdf() {
    if (!state.files || state.files.length < 2) {
        showAlert('Missing Images', 'Please upload exactly 2 images — front and back of the identity card.');
        return;
    }

    if (state.files.length > 2) {
        showAlert('Too Many Images', 'Please upload exactly 2 images — one for the front, one for the back.');
        return;
    }

    const labelText = (document.getElementById('ic-label-text') as HTMLInputElement)?.value || '';

    showLoader('Generating ID Card PDF...');

    try {
        const pdfDoc = await PDFLibDocument.create();
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

        // Create an A4 page
        const page = pdfDoc.addPage([A4_WIDTH, A4_HEIGHT]);

        // Embed both images
        const frontFile = state.files[0];
        const backFile = state.files[1];

        const frontImage = await embedImage(pdfDoc, frontFile);
        const backImage = await embedImage(pdfDoc, backFile);

        // Available drawing area
        const drawWidth = A4_WIDTH - (PAGE_MARGIN * 2);
        const availableHeightPerImage = (A4_HEIGHT - (PAGE_MARGIN * 2) - IMAGE_GAP) / 2;

        // Scale front image to fit in the top half
        const frontScale = Math.min(
            drawWidth / frontImage.width,
            availableHeightPerImage / frontImage.height
        );
        const frontW = frontImage.width * frontScale;
        const frontH = frontImage.height * frontScale;

        // Scale back image to fit in the bottom half
        const backScale = Math.min(
            drawWidth / backImage.width,
            availableHeightPerImage / backImage.height
        );
        const backW = backImage.width * backScale;
        const backH = backImage.height * backScale;

        // Position: front image at the top, back image at the bottom
        // PDF coordinate system: (0,0) is bottom-left
        const frontX = PAGE_MARGIN + (drawWidth - frontW) / 2;
        const frontY = A4_HEIGHT - PAGE_MARGIN - frontH;

        const backX = PAGE_MARGIN + (drawWidth - backW) / 2;
        const backY = PAGE_MARGIN;

        // Draw labels above images
        const labelFontSize = 11;
        page.drawText('FRONT', {
            x: frontX,
            y: frontY + frontH + 14,
            font,
            size: labelFontSize,
            color: rgb(0.2, 0.2, 0.2),
        });

        page.drawText('BACK', {
            x: backX,
            y: backY + backH + 14,
            font,
            size: labelFontSize,
            color: rgb(0.2, 0.2, 0.2),
        });

        // Draw the front image
        page.drawImage(frontImage, {
            x: frontX,
            y: frontY,
            width: frontW,
            height: frontH,
        });

        // Draw the back image
        page.drawImage(backImage, {
            x: backX,
            y: backY,
            width: backW,
            height: backH,
        });

        // Draw corner cross-out line and text for front image
        drawCornerCrossOut(page, frontX, frontY, frontW, frontH, font, labelText);

        // Draw corner cross-out line and text for back image
        drawCornerCrossOut(page, backX, backY, backW, backH, font, labelText);

        // Save and download
        const pdfBytes = await pdfDoc.save();
        const filename = labelText.trim()
            ? `ic-${labelText.trim().replace(/[^a-zA-Z0-9]/g, '_')}.pdf`
            : 'id-card.pdf';
        downloadFile(new Blob([new Uint8Array(pdfBytes)], { type: 'application/pdf' }), filename);
    } catch (e) {
        console.error(e);
        showAlert('Error', e.message || 'Failed to create ID Card PDF.');
    } finally {
        hideLoader();
    }
}
