#!/bin/sh
# Build the C++ sandbox image. The tag must match `image:` in challenge.md.
set -eu
cd "$(dirname "$0")"
docker build -t til-cpp ./cpp
