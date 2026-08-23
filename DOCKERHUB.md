# BentoPDF

A privacy-first, client-side PDF toolkit that runs entirely in the browser. No files are uploaded to any server.

This is a self-hosted fork of [goodtab/bentopdf](https://github.com/goodtab/bentopdf), streamlined for personal/homelab deployment with additional features.

## Changes from upstream

- Stripped unnecessary banners and external links for clean self-hosting
- Added **ID Card to PDF** tool (Malaysian IC style with parallel cross-lines and label text)
- Upgraded dependencies for security (pdfjs-dist, jspdf)
- Pinned all dependency versions for reproducible builds
- Multi-arch support (amd64/arm64)

## Quick Start

```bash
docker run -d -p 3000:8080 --name bentopdf vlmh88/bentopdf:latest
```

Open http://localhost:3000

## Docker Compose

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

## Credits

- Upstream: [goodtab/bentopdf](https://github.com/goodtab/bentopdf)
- License: Apache-2.0
