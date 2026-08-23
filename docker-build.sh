#!/bin/sh

# Build and push multi-arch image
# For private registry:
#   docker buildx build --platform linux/amd64,linux/arm64 -t repo.vlmh.work/bentopdf:latest --push .
# For Docker Hub (replace YOUR_DOCKERHUB_USER):
#   docker buildx build --platform linux/amd64,linux/arm64 -t YOUR_DOCKERHUB_USER/bentopdf:latest --push .

docker buildx build --platform linux/amd64,linux/arm64 -t repo.vlmh.work/bentopdf:latest --push .
