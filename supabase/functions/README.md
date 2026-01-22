# Supabase Edge Functions

## Setup

1. Install Supabase CLI if you haven't:
```bash
npm install -g supabase
```

2. Login to Supabase:
```bash
supabase login
```

3. Link your project:
```bash
supabase link --project-ref rgsulxuitaktxwmcozya
```

## Deploy the create-user function

```bash
supabase functions deploy create-user
```

## Test locally

```bash
supabase functions serve create-user
```

Then test with curl:
```bash
curl -i --location --request POST 'http://localhost:54321/functions/v1/create-user' \
  --header 'Authorization: Bearer YOUR_ANON_KEY' \
  --header 'Content-Type: application/json' \
  --data '{"email":"test@example.com","name":"Test User","base_role":"worker","organization_id":"YOUR_ORG_ID"}'
```

## What this function does

1. Verifies the caller is an admin
2. Creates an auth user using the admin API
3. Creates a user_profile with that user's ID
4. Returns the created user profile

This solves the issue where the frontend can't create auth users directly without exposing the service role key.
