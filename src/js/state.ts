export const state = {
    activeTool: null,
    files: [],
    pdfDoc: null,
    pdfPages: [],
    currentPdfUrl: null,
};

// Resets the state when switching views or completing an operation.
export function resetState() {
    state.activeTool = null;
    state.files = [];
    state.pdfDoc = null;
    state.pdfPages = [];
    if (state.currentPdfUrl) {
        URL.revokeObjectURL(state.currentPdfUrl);
    }
    state.currentPdfUrl = null;
    const toolContent = document.getElementById('tool-content');
    if (toolContent) toolContent.innerHTML = '';
}