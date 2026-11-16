# TIL - Content Format

This document describes how to author modules and challenges for TIL.

---

## Repository Layout

```
content/
├── <module-id>/
│   ├── module.md
│   └── <challenge-id>/
│       ├── challenge.md
│       ├── check
│       └── files/
│           └── (starter files)
```

- `content/` is the root folder (configurable via `CONTENT_DIR` env var, defaults to `../content` from the api folder).
- Each module is a folder named by its `id`.
- Each challenge is a folder inside its module, named by its `id`.

---

## Module Format (`module.md`)

A module folder contains a `module.md` file with a YAML front-matter header:

```yaml
---
id: cpp-basics
title: C++ Basics
description: Learn the fundamentals of C++
order: 1
---
```

### Fields

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `id` | string | Yes | Must match the folder name exactly |
| `title` | string | Yes | Display title |
| `description` | string | Yes | Shown on module list |
| `order` | integer | Yes | Sort order (ascending) |

### Validation Rules

- The `id` must match the folder name (e.g., folder `cpp-basics` → `id: cpp-basics`).
- Invalid modules are reported on the module list page with a clear error and do not crash the app.

---

## Challenge Format (`challenge.md`)

A challenge folder contains a `challenge.md` file with a YAML front-matter header followed by a Markdown body:

```yaml
---
id: hello-fix
title: Hello, compiler
module: cpp-basics
tier: 1
flag: "TIL{h3llo_c0mpiler}"
image: til-cpp
order: 1
links:
  - type: doc
    url: https://en.cppreference.com/w/cpp/io/cout
    label: std::cout reference
---
`files/main.cpp` should print `Hello, TIL!` but it does not compile.

Fix it, then run `./check` in the challenge folder. When it passes it prints the flag.

## Guide
The compiler points at line 4: a statement is missing its terminating `;`.
```

### Header Fields

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `id` | string | Yes | Must match the challenge folder name exactly |
| `title` | string | Yes | Display title |
| `module` | string | Yes | Must match the parent module folder name |
| `tier` | integer | Yes | Must be 1, 2, or 3 (points awarded = tier) |
| `flag` | string | Yes | Must match regex `^TIL\{.*\}$` |
| `image` | string | Yes | Docker image name for the sandbox (e.g., `til-cpp`) |
| `order` | integer | Yes | Sort order within module (ascending) |
| `links` | array | No | Optional array of link objects |

### Link Objects

Each link has:
- `type`: `"doc"` or `"video"`
- `url`: string, must be a valid HTTP/HTTPS URL
- `label`: string, display text

### Validation Rules

- `id` must match the challenge folder name.
- `module` must match the parent module folder name.
- `tier` must be 1, 2, or 3.
- `flag` must be in format `TIL{...}`.
- `links[i].url` must start with `http://` or `https://`.
- Duplicate challenge IDs across modules are reported as broken.
- Invalid challenges are reported on the page with a clear error and do not crash the app.

---

## The `## Guide` Section

The Markdown body is split at the **first line** whose trimmed content is exactly:

```
## Guide
```

- Everything **before** that line is the **briefing** (shown on the challenge page).
- Everything **after** that line is the **guide** (shown only when the user clicks "View answer").
- The `## Guide` line itself is not included in either part.
- If no `## Guide` line exists, the entire body is the briefing and there is no guide.
- The guide is rendered as Markdown (same as the briefing).

### Example

```markdown
This is the briefing. It explains the problem.

## Guide

This is the guide. It explains the solution.
- Step 1
- Step 2
```

---

## The `files/` Folder

The `files/` folder contains starter files for the challenge. These are copied into the sandbox container at `/workspace/files/` when the session starts.

- Any file structure is allowed.
- Files are copied with their permissions (mode 0644 for files, 0755 for directories).
- Ownership inside the container: uid/gid 1000 (the `learner` user).

---

## The `check` Script

Each challenge must include an executable `check` script at the challenge folder root (next to `challenge.md`).

### Convention

- The script runs from `/workspace` inside the container.
- It should `cd "$(dirname "$0")"` to find the challenge files.
- It compiles/runs the learner's work.
- **It prints the flag (exactly `TIL{...}`) to stdout ONLY when the solution passes.**
- On failure, it prints an error message (anything except the flag).
- Exit code is not used for pass/fail; the flag in stdout is the signal.

### Example (`check`)

```bash
#!/bin/sh
cd "$(dirname "$0")"
g++ -std=c++17 -o main files/main.cpp 2>&1
if [ $? -ne 0 ]; then
    echo "Compilation failed"
    exit 1
fi
./main
if [ $? -eq 0 ]; then
    echo "TIL{h3llo_c0mpiler}"
fi
```

### Requirements

- **Line endings must be LF** (enforced by `.gitattributes`). CRLF breaks the shebang.
- Must be executable (`chmod +x check`).
- The script and all files in `files/` are **readable by the learner** inside the container. Do not put secrets in them.

---

## Sandbox Image

The `image` field in `challenge.md` references a Docker image that must exist on the Docker host. For C++ challenges, the project provides a `til-cpp` image built from `sandbox-images/cpp/Dockerfile`.

To build the image:

```bash
cd sandbox-images/cpp
./build.sh
```

The image is multi-arch (amd64/arm64) and includes: gcc, g++, make, vim, nano.

---

## Adding a New Module

1. Create a folder under `content/` with the module id as the name.
2. Add `module.md` with the required fields.
3. Create challenge folders inside it.

## Adding a New Challenge

1. Create a folder under the module folder with the challenge id as the name.
2. Add `challenge.md` with the required header and body (including `## Guide` if desired).
3. Add a `files/` folder with starter files.
4. Add an executable `check` script (LF endings).
5. Verify the challenge works by running it in the sandbox.

---

## Notes

- The app reads content from disk on every request (no caching in dev). Editing a file shows up on refresh without restart.
- The flag is **never** sent to the browser in list or detail pages. It is only compared server-side when the user submits a flag.
- The guide is **never** sent to the browser unless the user clicks "View answer" (HTMX fragment).
- Anything copied into the sandbox (including `check` and all `files/`) is readable by the learner inside the container.