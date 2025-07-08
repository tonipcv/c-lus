#!/bin/bash

# Ensure android/app directory exists
mkdir -p android/app

# Copy google-services.json to android/app if it exists in root
if [ -f "google-services.json" ]; then
    echo "✅ Found google-services.json in root directory"
    cp google-services.json android/app/
    echo "✅ Copied google-services.json to android/app/"
    chmod 644 android/app/google-services.json
    echo "✅ Set correct permissions for google-services.json"
else
    echo "❌ google-services.json not found in root directory"
    exit 1
fi

# Verify the file exists in android/app
if [ -f "android/app/google-services.json" ]; then
    echo "✅ Verified google-services.json exists in android/app/"
else
    echo "❌ Failed to copy google-services.json to android/app/"
    exit 1
fi 