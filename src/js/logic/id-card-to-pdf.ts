import { showLoader, hideLoader, showAlert } from '../ui.js';
import { downloadFile, readFileAsArrayBuffer } from '../utils/helpers.js';
import { state } from '../state.js';

import { PDFDocument as PDFLibDocument, rgb, StandardFonts, degrees } from 'pdf-lib';

// A4 dimensions in points (72 points per inch)
const A4_WIDTH = 595.28;
const A4_HEIGHT = 841.89;

// Diagonal cross-line settings
const LINE_THICKNESS = 1.5;
const LINE_COLOR = rgb(0, 0, 0);
const TEXT_COLOR = rgb(0, 0, 0);
const TEXT_FONT_SIZE = 24;
const LINE_GAP = 30; // perpendicular distance between the two parallel lines

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
 * Draws 2 parallel diagonal lines across the ENTIRE image (bottom-left to top-right),
 * with large bold text written between the two lines.
 * This matches the Malaysian IC photocopy "certified true copy" style.
 */
function drawDiagonalCrossLines(page: any, x: number, y: number, width: number, height: number, font: any, text: string) {
    // The lines go from bottom-left to top-right of the image area
    // We offset them perpendicular to the diagonal direction to create parallel lines

    // Calculate the diagonal angle
    const angle = Math.atan2(height, width); // angle in radians from horizontal

    // Perpendicular offset (to shift lines apart from each other)
    const offsetX = (LINE_GAP / 2) * Math.sin(angle);
    const offsetY = (LINE_GAP / 2) * Math.cos(angle);

    // Line 1 (shifted up-left from center diagonal)
    page.drawLine({
        start: { x: x - offsetX, y: y - offsetY },
        end: { x: x + width - offsetX, y: y + height - offsetY },
        thickness: LINE_THICKNESS,
        color: LINE_COLOR,
    });

    // Line 2 (shifted down-right from center diagonal)
    page.drawLine({
        start: { x: x + offsetX, y: y + offsetY },
        end: { x: x + width + offsetX, y: y + height + offsetY },
        thickness: LINE_THICKNESS,
        color: LINE_COLOR,
    });

    // Draw the text between the two lines, rotated to follow the diagonal
    if (text.trim()) {
        const angleDegrees = (angle * 180) / Math.PI;

        // Calculate text width to center it along the diagonal
        const textWidth = font.widthOfTextAtSize(text.toUpperCase(), TEXT_FONT_SIZE);
        const diagonalLength = Math.sqrt(width * width + height * height);

        // Position text at the center of the diagonal
        const centerProgress = (diagonalLength - textWidth) / (2 * diagonalLength);
        const textX = x + width * centerProgress;
        const textY = y + height * centerProgress;

        page.drawText(text.toUpperCase(), {
            x: textX,
            y: textY,
            font,
            size: TEXT_FONT_SIZE,
            color: TEXT_COLOR,
            rotate: degrees(angleDegrees),
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
        const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

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

        // Draw diagonal cross lines and text over front image
        drawDiagonalCrossLines(page, frontX, frontY, frontW, frontH, font, labelText);

        // Draw diagonal cross lines and text over back image
        drawDiagonalCrossLines(page, backX, backY, backW, backH, font, labelText);

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
