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
