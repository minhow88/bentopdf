#!/bin/sh

# Build and push multi-arch image
# For Docker Hub:
docker buildx build --platform linux/amd64,linux/arm64 -t vlmh88/bentopdf:latest --push .
