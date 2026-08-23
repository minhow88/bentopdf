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
const TEXT_FONT_SIZE = 14;

// IC card physical size: 85.60 × 53.98 mm converted to points (1 mm = 2.8346 pts)
const IC_WIDTH_PT = 85.60 * 2.8346;  // ~242.6 pts
const IC_HEIGHT_PT = 53.98 * 2.8346; // ~153.0 pts

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
 * Draws 2 parallel diagonal lines across the image,
 * with text written between the two lines.
 * Both lines go from left edge (above mid) to top edge (around mid).
 * They are parallel — same direction, offset perpendicular to each other.
 * This matches the Malaysian IC photocopy "certified true copy" style.
 */
function drawDiagonalCrossLines(page: any, x: number, y: number, width: number, height: number, font: any, text: string) {
    // Central line direction: extends from before left edge to beyond top edge
    // The line angle is defined by (0, 83% height) → (65% width, 100% height)
    // We extend the start further left and end further right along the same slope
    const slope = (height * 0.17) / (width * 0.65); // dy/dx of the line
    const extendLeft = width * 0.20; // extend 20% of width to the left
    const extendRight = width * 0.20; // extend 20% of width to the right
    const centerStartX = x - extendLeft;
    const centerStartY = y + height * 0.83 - slope * extendLeft;
    const centerEndX = x + width * 0.65 + extendRight;
    const centerEndY = y + height + slope * extendRight;

    // Calculate the angle and perpendicular offset
    const dx = centerEndX - centerStartX;
    const dy = centerEndY - centerStartY;
    const angle = Math.atan2(dy, dx);

    // Gap between lines — tight, just enough for the text
    const gap = TEXT_FONT_SIZE * 1.2;
    const offsetX = (gap / 2) * Math.sin(angle);
    const offsetY = (gap / 2) * Math.cos(angle);

    // Line 1 (upper): shifted one way perpendicular
    page.drawLine({
        start: { x: centerStartX + offsetX, y: centerStartY - offsetY },
        end: { x: centerEndX + offsetX, y: centerEndY - offsetY },
        thickness: LINE_THICKNESS,
        color: LINE_COLOR,
    });

    // Line 2 (lower): shifted other way perpendicular
    page.drawLine({
        start: { x: centerStartX - offsetX, y: centerStartY + offsetY },
        end: { x: centerEndX - offsetX, y: centerEndY + offsetY },
        thickness: LINE_THICKNESS,
        color: LINE_COLOR,
    });

    // Draw the text between the two lines, rotated to follow the diagonal
    if (text.trim()) {
        const angleDegrees = (angle * 180) / Math.PI;

        // Center text along the line, shifted toward the bottom line
        const textWidth = font.widthOfTextAtSize(text.toUpperCase(), TEXT_FONT_SIZE);
        const lineLength = Math.sqrt(dx * dx + dy * dy);
        const centerProgress = (lineLength - textWidth) / (2 * lineLength);
        const textX = centerStartX + dx * centerProgress + offsetX * 0.6;
        const textY = centerStartY + dy * centerProgress - offsetY * 0.6;

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

        // Use actual IC card dimensions (85.60 × 53.98 mm)
        const frontW = IC_WIDTH_PT;
        const frontH = IC_HEIGHT_PT;

        const backW = IC_WIDTH_PT;
        const backH = IC_HEIGHT_PT;

        // Position: center both cards horizontally, stack vertically with gap
        // PDF coordinate system: (0,0) is bottom-left
        const totalHeight = frontH + backH + IMAGE_GAP;
        const startY = (A4_HEIGHT + totalHeight) / 2; // top of front image

        const frontX = (A4_WIDTH - frontW) / 2;
        const frontY = startY - frontH;

        const backX = (A4_WIDTH - backW) / 2;
        const backY = frontY - IMAGE_GAP - backH;

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
