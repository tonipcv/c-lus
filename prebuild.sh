#!/bin/bash

# Ensure android/app directory exists
mkdir -p android/app

# Copy google-services.json to android/app
cp google-services.json android/app/

# Make the file readable
chmod 644 android/app/google-services.json

echo "✅ google-services.json copied to android/app/" 