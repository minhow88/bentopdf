import { showLoader, hideLoader, showAlert } from '../ui.js';
import { downloadFile, hexToRgb } from '../utils/helpers.js';
import { state } from '../state.js';
import { rgb, StandardFonts } from 'pdf-lib';
import { icons, createIcons } from 'lucide';

/**
 * Edit PDF Content — add text boxes onto existing pages.
 *
 * pdf-lib cannot reliably rewrite the existing text content streams of an
 * arbitrary PDF, so "editing content" here means overlaying new text at chosen
 * coordinates (measured in points from the bottom-left of the page). This
 * covers the common need to insert, annotate, or correct text on a page.
 */

function createTextBoxRow(): HTMLElement {
    const totalPages = state.pdfDoc ? state.pdfDoc.getPageCount() : 1;
    const row = document.createElement('div');
    row.className = 'content-box-row grid grid-cols-12 gap-2 items-end bg-gray-900 border border-gray-700 rounded-lg p-3';
    row.innerHTML = `
        <div class="col-span-12 md:col-span-5">
            <label class="block mb-1 text-xs font-medium text-gray-400">Text</label>
            <input type="text" class="cb-text w-full bg-gray-800 border border-gray-600 text-white rounded-lg p-2" placeholder="Text to add">
        </div>
        <div class="col-span-4 md:col-span-1">
            <label class="block mb-1 text-xs font-medium text-gray-400">Page</label>
            <input type="number" min="1" max="${totalPages}" value="1" class="cb-page w-full bg-gray-800 border border-gray-600 text-white rounded-lg p-2">
        </div>
        <div class="col-span-4 md:col-span-1">
            <label class="block mb-1 text-xs font-medium text-gray-400">X</label>
            <input type="number" min="0" value="72" class="cb-x w-full bg-gray-800 border border-gray-600 text-white rounded-lg p-2">
        </div>
        <div class="col-span-4 md:col-span-1">
            <label class="block mb-1 text-xs font-medium text-gray-400">Y</label>
            <input type="number" min="0" value="700" class="cb-y w-full bg-gray-800 border border-gray-600 text-white rounded-lg p-2">
        </div>
        <div class="col-span-4 md:col-span-1">
            <label class="block mb-1 text-xs font-medium text-gray-400">Size</label>
            <input type="number" min="1" value="12" class="cb-size w-full bg-gray-800 border border-gray-600 text-white rounded-lg p-2">
        </div>
        <div class="col-span-4 md:col-span-1">
            <label class="block mb-1 text-xs font-medium text-gray-400">Color</label>
            <input type="color" value="#000000" class="cb-color w-full h-[40px] bg-gray-800 border border-gray-600 rounded-lg p-1 cursor-pointer">
        </div>
        <div class="col-span-4 md:col-span-2 flex gap-1">
            <label class="flex items-center gap-1 text-xs text-gray-400">
                <input type="checkbox" class="cb-cover"> White bg
            </label>
            <button type="button" class="cb-remove btn ml-auto p-2 text-red-500 hover:bg-gray-700 rounded-full">
                <i data-lucide="trash-2"></i>
            </button>
        </div>
    `;
    const removeBtn = row.querySelector('.cb-remove');
    removeBtn?.addEventListener('click', () => row.remove());
    return row;
}

export function setupEditContentTool() {
    const totalPagesSpan = document.getElementById('total-pages');
    if (totalPagesSpan && state.pdfDoc) {
        totalPagesSpan.textContent = String(state.pdfDoc.getPageCount());
    }

    const container = document.getElementById('content-boxes');
    const addBtn = document.getElementById('add-content-box-btn');
    if (!container || !addBtn) return;

    // Start with one row if empty.
    if (container.children.length === 0) {
        container.appendChild(createTextBoxRow());
        createIcons({ icons });
    }

    addBtn.onclick = () => {
        container.appendChild(createTextBoxRow());
        createIcons({ icons });
    };
}

export async function editContent() {
    if (!state.pdfDoc) {
        showAlert('Error', 'PDF not loaded.');
        return;
    }

    const rows = Array.from(document.querySelectorAll('.content-box-row'));
    if (rows.length === 0) {
        showAlert('Nothing to add', 'Add at least one text box.');
        return;
    }

    showLoader('Applying content edits...');
    try {
        const doc = state.pdfDoc;
        const font = await doc.embedFont(StandardFonts.Helvetica);
        const pages = doc.getPages();
        const totalPages = pages.length;
        let applied = 0;

        for (const row of rows) {
            const text = (row.querySelector('.cb-text') as HTMLInputElement)?.value ?? '';
            if (!text.trim()) continue;

            const pageNum = parseInt((row.querySelector('.cb-page') as HTMLInputElement)?.value || '1', 10);
            if (isNaN(pageNum) || pageNum < 1 || pageNum > totalPages) continue;

            const x = parseFloat((row.querySelector('.cb-x') as HTMLInputElement)?.value || '0');
            const y = parseFloat((row.querySelector('.cb-y') as HTMLInputElement)?.value || '0');
            const size = parseFloat((row.querySelector('.cb-size') as HTMLInputElement)?.value || '12');
            const colorHex = (row.querySelector('.cb-color') as HTMLInputElement)?.value || '#000000';
            const cover = (row.querySelector('.cb-cover') as HTMLInputElement)?.checked ?? false;
            const color = hexToRgb(colorHex);

            const page = pages[pageNum - 1];

            // Optionally draw a white rectangle behind the text to "cover" the
            // area beneath (useful for correcting/replacing existing text).
            if (cover) {
                const textWidth = font.widthOfTextAtSize(text, size);
                page.drawRectangle({
                    x: x - 1,
                    y: y - size * 0.25,
                    width: textWidth + 2,
                    height: size * 1.25,
                    color: rgb(1, 1, 1),
                });
            }

            page.drawText(text, {
                x,
                y,
                size,
                font,
                color: rgb(color.r, color.g, color.b),
            });
            applied++;
        }

        if (applied === 0) {
            hideLoader();
            showAlert('Nothing applied', 'Please provide text and valid page numbers for at least one box.');
            return;
        }

        const newBytes = await doc.save();
        downloadFile(new Blob([newBytes], { type: 'application/pdf' }), 'edited-content.pdf');
    } catch (e) {
        console.error(e);
        showAlert('Error', 'Could not apply content edits.');
    } finally {
        hideLoader();
    }
}
