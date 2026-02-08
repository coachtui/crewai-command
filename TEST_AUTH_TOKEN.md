# Test Your Auth Token

## Check if you're logged in and have a valid session:

1. Open your app in the browser
2. Open the browser console (F12 or Cmd+Option+I)
3. Run this:

```javascript
// Check if you're logged in
const { data: { session }, error } = await window.supabase.auth.getSession()
console.log('Session:', session)
console.log('User:', session?.user)
console.log('Access token:', session?.access_token?.substring(0, 20) + '...')
console.log('Error:', error)
```

## Expected output:

If you're logged in, you should see:
- `Session: { access_token: '...', user: {...}, ... }`
- `User: { id: '...', email: '...', ... }`
- `Access token: eyJhbGciOiJIUzI1NiI...`

If you see `Session: null`, you're not logged in!

## Check your admin status:

```javascript
const { data, error } = await window.supabase
  .from('user_profiles')
  .select('base_role, email')
  .eq('id', (await window.supabase.auth.getSession()).data.session?.user?.id)
  .single()

console.log('Your role:', data?.base_role)
console.log('Your email:', data?.email)
```

## If you're not logged in:

1. Log out completely
2. Log back in
3. Try creating a user again

## If you're not an admin:

Run this SQL in Supabase Dashboard:
```sql
UPDATE user_profiles
SET base_role = 'admin'
WHERE email = 'YOUR_EMAIL@gmail.com';
```
