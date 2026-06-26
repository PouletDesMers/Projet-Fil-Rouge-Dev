#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${1:-.}"

patterns=(
  'sk_test_[A-Za-z0-9]{20,}'
  'pk_test_[A-Za-z0-9]{20,}'
  're_[A-Za-z0-9]{20,}'
)

exit_code=0

for pattern in "${patterns[@]}"; do
  if grep -RInE --exclude-dir=node_modules --exclude-dir=.git --exclude='*.lock' "$pattern" "$ROOT_DIR"; then
    exit_code=1
  fi
done

while IFS= read -r file; do
  while IFS= read -r line; do
    case "$line" in
      API_SECRET=your_*|RESTIC_PASSWORD=your_*|API_KEY=your_*)
        continue
        ;;
      API_SECRET=*|RESTIC_PASSWORD=*|API_KEY=*)
        value="${line#*=}"
        case "$value" in
          your_*|sk_test_*|pk_test_*|re_*|*_...)
            continue
            ;;
        esac
        if [ ${#value} -ge 20 ]; then
          echo "Potential secret value found in $file: $line"
          exit_code=1
        fi
        ;;
    esac
  done < "$file"
done < <(find "$ROOT_DIR" -maxdepth 2 \( -name '.env' -o -name '.env.example' \) -type f)

# Catch common tracked artifacts that should never be committed.
for forbidden in "api/api" "cookies.txt"; do
  if [ -e "$ROOT_DIR/$forbidden" ]; then
    echo "Forbidden artifact found: $forbidden"
    exit_code=1
  fi
done

exit "$exit_code"
