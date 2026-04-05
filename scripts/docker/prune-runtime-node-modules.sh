#!/bin/sh
set -eu

ROOT="${1:-/app/node_modules}"

if [ ! -d "$ROOT" ]; then
  exit 0
fi

# Remove documentation and test assets that are not needed at runtime.
find "$ROOT" -type f \
  \( \
    -iname 'README*' -o \
    -iname 'CHANGELOG*' -o \
    -iname 'HISTORY*' -o \
    -name '.travis.yml' -o \
    -name '.npmignore' -o \
    -name '.eslintrc' -o \
    -name '.eslintrc.*' -o \
    -name '.nycrc' -o \
    -name '.nycrc.*' -o \
    -name 'tsconfig.json' -o \
    -name 'tsconfig.*' -o \
    -name 'vitest.config.*' -o \
    -name 'jest.config.*' -o \
    -name '*.map' \
  \) -delete

# Remove common fixture and test directories from installed packages.
find "$ROOT" -type d \
  \( \
    -name test -o \
    -name tests -o \
    -name '__tests__' -o \
    -name example -o \
    -name examples -o \
    -name docs -o \
    -name doc -o \
    -name benchmark -o \
    -name benchmarks -o \
    -name coverage -o \
    -name '.github' \
  \) -prune -exec rm -rf '{}' +
