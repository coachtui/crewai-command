#!/bin/bash

# Get a fresh token first - run this in browser console:
#   copy(JSON.parse(localStorage.getItem('sb-rgsulxuitaktxwmcozya-auth-token')).access_token)
# Then: pbpaste > /tmp/token.txt

ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJnc3VseHVpdGFrdHh3bWNvenlhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc5OTgxMzksImV4cCI6MjA4MzU3NDEzOX0.NvPJYXWKf9pMQg82iKuCFQm4_rTvRz7d6tB2SA89QZs"

# Support token from file or argument
if [ -f "/tmp/token.txt" ] && [ -z "$1" ]; then
  TOKEN=$(cat /tmp/token.txt)
  echo "Using token from /tmp/token.txt"
elif [ -n "$1" ]; then
  TOKEN="$1"
else
  echo "Usage: ./test-function.sh [TOKEN]"
  echo ""
  echo "Option 1 - Token from file (recommended to avoid truncation):"
  echo "  In browser console: copy(JSON.parse(localStorage.getItem('sb-rgsulxuitaktxwmcozya-auth-token')).access_token)"
  echo "  Then run: pbpaste > /tmp/token.txt"
  echo "  Then run: ./test-function.sh"
  echo ""
  echo "Option 2 - Token as argument:"
  echo "  ./test-function.sh YOUR_ACCESS_TOKEN"
  exit 1
fi

curl -i -X POST 'https://rgsulxuitaktxwmcozya.supabase.co/functions/v1/create-user' \
  -H "Authorization: Bearer $TOKEN" \
  -H "apikey: $ANON_KEY" \
  -H 'Content-Type: application/json' \
  -d '{"email":"test@test.com","name":"Test User","base_role":"worker","organization_id":"test"}'
