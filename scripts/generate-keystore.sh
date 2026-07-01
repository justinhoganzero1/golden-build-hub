#!/usr/bin/env bash
# Generate an Android release keystore for Oracle Lunar and print
# the exact values to paste into Codemagic → Environment variables
# (group: android_signing).
#
# Run locally (needs Java's keytool):
#   bash scripts/generate-keystore.sh
#
# IMPORTANT: Back up release.keystore somewhere safe (password manager,
# encrypted drive). If you lose it you can NEVER update this app on the
# Play Store again — you'd have to publish as a brand-new app.

set -euo pipefail

KEYSTORE_FILE="release.keystore"
KEY_ALIAS="oraclelunar"
VALIDITY_DAYS=10000  # ~27 years, Play Store requires >=25 years past Oct 2033

if [ -f "$KEYSTORE_FILE" ]; then
  echo "❌ $KEYSTORE_FILE already exists in $(pwd). Move or delete it first." >&2
  exit 1
fi

if ! command -v keytool >/dev/null 2>&1; then
  echo "❌ 'keytool' not found. Install a JDK (e.g. 'brew install openjdk@17' or 'apt install default-jdk')." >&2
  exit 1
fi

echo "You'll be asked to set TWO passwords (use the same one for both to keep it simple)."
echo "You'll also be asked for name/org/city — any real-ish values are fine, they're embedded in the cert."
echo ""
read -r -s -p "Choose a keystore password (min 6 chars): " KS_PW
echo ""
read -r -s -p "Confirm password: " KS_PW2
echo ""
if [ "$KS_PW" != "$KS_PW2" ] || [ ${#KS_PW} -lt 6 ]; then
  echo "❌ Passwords don't match or too short." >&2
  exit 1
fi

keytool -genkeypair -v \
  -keystore "$KEYSTORE_FILE" \
  -alias "$KEY_ALIAS" \
  -keyalg RSA -keysize 2048 \
  -validity "$VALIDITY_DAYS" \
  -storepass "$KS_PW" \
  -keypass "$KS_PW"

echo ""
echo "✅ Created $KEYSTORE_FILE"
echo ""
echo "════════════════════════════════════════════════════════════════"
echo "Paste these into Codemagic → Teams → Environment variables"
echo "  Group name: android_signing   (mark all as Secure)"
echo "════════════════════════════════════════════════════════════════"
echo ""
echo "CM_KEY_ALIAS         = $KEY_ALIAS"
echo "CM_KEYSTORE_PASSWORD = <the password you just typed>"
echo "CM_KEY_PASSWORD      = <same password>"
echo ""
echo "ANDROID_KEYSTORE     = (base64 below, copy the ENTIRE block as one line)"
echo "----------------------------------------------------------------"
base64 -w0 "$KEYSTORE_FILE" 2>/dev/null || base64 "$KEYSTORE_FILE" | tr -d '\n'
echo ""
echo "----------------------------------------------------------------"
echo ""
echo "🔒 Now BACK UP $KEYSTORE_FILE somewhere safe and add it to .gitignore."
echo "   Do NOT commit it to git."
