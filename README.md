# BentoPDF (Self-Hosted Fork)

A privacy-first, client-side PDF toolkit that runs entirely in the browser. No files are uploaded to any server.

> **Fork Notice:** This repository is a fork of [goodtab/bentopdf](https://github.com/goodtab/bentopdf), originally created by [Abdullah Alam](https://github.com/alam00000). The upstream project is licensed under the [Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0). This fork is maintained independently and is not affiliated with or endorsed by the original author.

---

## About This Fork

This fork is streamlined for personal and homelab self-hosting, with additional features and hardened Docker deployment. It is distributed under the same Apache 2.0 license as the upstream project.

### Changes from Upstream

- Removed external banners and promotional links for clean self-hosted use
- Added **ID Card to PDF** tool (Malaysian IC style with parallel cross-lines and label text)
- Added document-size presets to the ID Card tool
- Upgraded dependencies for security (`pdfjs-dist`, `jspdf`)
- Pinned all dependency versions for reproducible builds
- Multi-architecture Docker support (amd64 / arm64)
- Hardened Docker image (non-root, read-only, capability-dropped)

---

## Quick Start (Docker)

```bash
docker run -d -p 3000:8080 --name bentopdf vlmh88/bentopdf:latest
```

Open your browser at http://localhost:3000.

### Docker Compose

```yaml
services:
  bentopdf:
    image: vlmh88/bentopdf:latest
    container_name: bentopdf
    ports:
      - "3000:8080"
    restart: unless-stopped
    read_only: true
    tmpfs:
      - /tmp
      - /var/run
    security_opt:
      - no-new-privileges:true
    cap_drop:
      - ALL
    mem_limit: 256m
```

---

## Local Development

### Prerequisites

- [Node.js](https://nodejs.org/) v18 or higher
- npm

### Setup

```bash
git clone https://github.com/minhow88/bentopdf.git
cd bentopdf
npm install
npm run dev
```

The dev server starts at `http://localhost:5173`.

### Build for Production

```bash
npm run build
```

Output is written to `dist/`.

### Run Tests

```bash
npm run test:run
```

---

## Features

BentoPDF provides a comprehensive suite of browser-based PDF tools including:

- Merge, split, extract, delete, and reorder pages
- Add page numbers, watermarks, headers/footers
- Crop, rotate, flatten, and edit PDFs
- Convert images (JPG, PNG, WebP, SVG, BMP, HEIC, TIFF) to PDF
- Convert PDF to images, greyscale, or searchable text (OCR)
- Compress, encrypt, decrypt, sign, and redact PDFs
- Edit and remove metadata
- Markdown and plain text to PDF conversion
- ID Card to PDF (fork addition)

For the full feature list, see the [upstream README](https://github.com/goodtab/bentopdf#readme).

---

## Tech Stack

- **Vite** — build tooling
- **TypeScript** — type safety
- **Tailwind CSS** — UI styling
- **pdf-lib**, **PDF.js**, **PDFKit** — PDF manipulation and rendering
- **Tesseract.js** — OCR
- **Nginx** — production static file serving (Docker)

---

## Upstream Attribution & Credits

This project is a derivative work of [BentoPDF](https://github.com/goodtab/bentopdf) by Abdullah Alam, used under the terms of the Apache License 2.0.

In compliance with Section 4 of the Apache License 2.0:

- The original LICENSE file is retained in this repository.
- Modified files carry notices of changes (via git history).
- All copyright, patent, trademark, and attribution notices from the original work are preserved.

### Open-Source Libraries

This project also depends on the following open-source libraries (see `package.json` for exact versions):

| Library | License |
| :--- | :--- |
| [pdf-lib](https://pdf-lib.js.org/) | MIT |
| [PDF.js](https://mozilla.github.io/pdf.js/) | Apache-2.0 |
| [PDFKit](https://pdfkit.org/) | MIT |
| [Cropper.js](https://fengyuanchen.github.io/cropperjs/) | MIT |
| [Tesseract.js](https://tesseract.projectnaptha.com/) | Apache-2.0 |
| [Vite](https://vitejs.dev/) | MIT |
| [Tailwind CSS](https://tailwindcss.com/) | MIT |

---

## License

This project is licensed under the **Apache License 2.0** — the same license as the upstream project.

```
Copyright 2025 Abdullah Alam (original work)
Copyright 2025 minhow88 (modifications)

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
```

See the [LICENSE](./LICENSE) file for the full text.

---

## Disclaimer

This fork is provided "as is" without warranty of any kind. It is not affiliated with, endorsed by, or sponsored by the original BentoPDF project or its maintainers. Use at your own risk.
