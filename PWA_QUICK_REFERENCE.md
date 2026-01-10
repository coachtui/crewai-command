# PWA Quick Reference Card

## 🚀 Deployment (When pushing updates)

```javascript
// 1. Edit public/sw.js - increment version numbers:
const CACHE_NAME = 'crewai-v3';        // increment this
const RUNTIME_CACHE = 'crewai-runtime-v3'; // and this

// 2. Commit and deploy
git add .
git commit -m "Release v3"
git push
```

## 🧪 Testing Updates Locally

```bash
# Build and preview
npm run build
npm run preview

# Open http://localhost:4173
# Make a change, rebuild, users will see update notification
```

## 🎯 Demo Mode (Disable SW)

```bash
# Add to .env.local:
VITE_DEMO_MODE=true

# Restart server:
npm run dev
```

## 🔧 Quick Troubleshooting

**Users stuck on old version?**
```
F12 → Application → Clear storage → Clear site data → Reload
```

**Test update notification?**
```
1. Increment version in public/sw.js
2. npm run build && npm run preview
3. Keep page open (don't reload)
4. Build again with a change
5. Wait 60 seconds - notification appears
```

**Check cache headers work?**
```
F12 → Network → Reload → Click index.html → Headers tab
Should see: Cache-Control: no-cache, no-store, must-revalidate
```

## 📁 Files Changed

- ✅ `public/sw.js` - Network-first for HTML, cache-first for assets
- ✅ `src/main.tsx` - Enhanced registration + update detection
- ✅ `src/components/ui/UpdateNotification.tsx` - Update UI toast
- ✅ `vercel.json` - Cache headers for Vercel
- ✅ `public/_headers` - Cache headers for Netlify/Cloudflare
- ✅ `.env.example` - Added VITE_DEMO_MODE

## 🎨 Update Notification

Appears as orange toast bottom-right when update available:
- Auto-checks every 60 seconds
- "Update Now" → Reloads with new version
- "Later" → Dismisses (can update later)
- Won't loop infinitely

## ⚡ Key Behaviors

| Resource | Strategy | Cache |
|----------|----------|-------|
| `index.html` | Network-First | Never cached by browser |
| `sw.js` | Network-First | Never cached by browser |
| `/assets/*.js` | Cache-First | Cached forever (immutable) |
| API calls | Network-First | Not cached |
| Offline | Fallback | Serves cached HTML |

## 📞 Support

For detailed testing: See `PWA_FIX_SUMMARY.md`
