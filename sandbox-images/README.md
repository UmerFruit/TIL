# Sandbox images

The app starts one session container per challenge from the image named in
`challenge.md` (`image: til-cpp` for the C++ challenges).

## Build

```sh
sh sandbox-images/build.sh
```

This runs `docker build -t til-cpp sandbox-images/cpp`. The app never pulls
images: if `til-cpp` is missing, the sandbox fragment tells you to run this
script.

## arm64 (production VPS)

The base image `gcc:14.2.0-bookworm` is multi-arch. To build for the arm64 VPS
from an x86 machine, use buildx:

```sh
docker buildx build --platform linux/arm64 -t til-cpp sandbox-images/cpp
```

Or build directly on the VPS (native arm64) with the plain `build.sh`.

## What is inside

- `gcc:14.2.0-bookworm` (pinned), plus `make`, `vim`, `nano`.
- Non-root user `learner` (uid/gid 1000), `/workspace` owned by it.
- `WORKDIR /workspace`, `CMD ["sleep", "infinity"]` so the container stays up
  for `docker exec` / the terminal bridge.
