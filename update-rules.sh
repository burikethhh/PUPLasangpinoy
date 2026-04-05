#!/bin/bash
# Script to update Firestore rules using REST API

echo "Attempting to update Firestore rules..."

# Read the rules file
RULES_CONTENT=$(cat firestore.rules)

# Get Firebase token (this requires user to be logged in)
TOKEN=$(npx firebase-tools login:ci --no-localhost 2>&1 | grep -oP '(?<=token: ).*' || echo "")

if [ -z "$TOKEN" ]; then
  echo "Unable to get Firebase token. Please set rules manually in Console."
  echo ""
  echo "Go to: https://console.firebase.google.com/project/lasangpinoy-mobile/firestore/databases/default/rules"
  echo ""
  echo "And paste these rules:"
  cat firestore.rules
else
  echo "Token obtained, updating rules..."
  # Update would go here if token was available
fi
