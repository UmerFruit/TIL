---
id: sum-fix
title: Off by one
module: cpp-basics
tier: 2
flag: "TIL{sum_1_to_10}"
image: til-cpp
order: 2
---
`files/sum.cpp` should print the sum of 1 through 10 (`55`) but prints something else.

Fix it, then run `./check`.

## Guide
The loop uses `i < 10`, so 10 is never added. Use `i <= 10`.
