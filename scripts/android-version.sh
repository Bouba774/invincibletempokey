#!/usr/bin/env bash
# Stamps versionCode / versionName into android/app/build.gradle.
# Usage: ./scripts/android-version.sh <versionCode> <versionName>
set -euo pipefail
CODE="${1:-1}"
NAME="${2:-1.0.0}"
GRADLE="android/app/build.gradle"
if [ ! -f "$GRADLE" ]; then
  echo "skip: $GRADLE not present"
  exit 0
fi
sed -i.bak -E "s/versionCode [0-9]+/versionCode ${CODE}/" "$GRADLE"
sed -i.bak -E "s/versionName \"[^\"]+\"/versionName \"${NAME}\"/" "$GRADLE"
rm -f "${GRADLE}.bak"
echo "Stamped versionCode=${CODE} versionName=${NAME}"
