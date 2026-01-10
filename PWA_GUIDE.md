# PWA Installation Guide for CrewAI

CrewAI is now configured as a Progressive Web App (PWA), making it installable on mobile and desktop devices!

## ✅ PWA Features Configured

- ✅ **Manifest file** (`public/manifest.json`)
- ✅ **Service worker** (`public/sw.js`) for offline support
- ✅ **Meta tags** in `index.html` for mobile optimization
- ✅ **Service worker registration** in `src/main.tsx`
- ✅ **App shortcuts** for quick access to key features

## 📱 Creating App Icons

You need to create two icon sizes. Here are your options:

### Option 1: Use an Icon Generator (Easiest)

1. Go to [https://realfavicongenerator.net/](https://realfavicongenerator.net/)
2. Upload your logo/icon (square image, 512x512px recommended)
3. Download the generated icons
4. Copy `icon-192x192.png` → `/public/icon-192.png`
5. Copy `icon-512x512.png` → `/public/icon-512.png`

### Option 2: Create Manually

Create two PNG files with your branding:
- `/public/icon-192.png` - 192x192 pixels
- `/public/icon-512.png` - 512x512 pixels

**Design Tips:**
- Use the CrewAI orange (#FF6B35) as primary color
- Keep it simple - icons appear small
- Use a construction/crew theme (hard hat, building, crew)
- Make it recognizable at small sizes

### Option 3: Temporary Placeholder

For quick testing, you can use colored squares:

1. Create simple colored PNG files at those sizes
2. Or copy your existing vite.svg and convert to PNG
3. Place them in `/public/` directory

## 📲 How to Install CrewAI as an App

### On Desktop (Chrome/Edge)

1. Visit your deployed site (or `http://localhost:5175`)
2. Look for install icon in address bar (⊕ or 💾)
3. Click it and select "Install"
4. App opens in its own window!

**Alternative:**
- Click three dots menu (⋮)
- Select "Install CrewAI Command..."

### On iPhone/iPad (Safari)

1. Open CrewAI in Safari
2. Tap the Share button (square with arrow)
3. Scroll and tap "Add to Home Screen"
4. Edit name if needed, tap "Add"
5. App icon appears on home screen!

### On Android (Chrome)

1. Open CrewAI in Chrome
2. Tap three dots menu (⋮)
3. Select "Install app" or "Add to Home Screen"
4. Tap "Install"
5. App icon appears on home screen!

## 🎯 App Shortcuts (Long Press Icon)

Once installed, you can long-press the app icon to access shortcuts:

- **Today** - Foreman's today schedule
- **Workers** - Manage crew members
- **Tasks** - View and assign tasks
- **Activities** - Superintendent's activity dashboard

## 🔌 Offline Support

The PWA includes basic offline support:

**What Works Offline:**
- App shell loads
- Previously cached pages
- Basic navigation

**What Needs Internet:**
- Supabase data (workers, tasks, assignments)
- Real-time updates
- New data changes

## 🚀 Production Deployment

For the PWA to work properly in production:

### 1. Deploy to Vercel

```bash
npm install -g vercel
vercel login
vercel --prod
```

### 2. Configure Environment Variables

In Vercel dashboard, add:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

### 3. Enable HTTPS

PWA requires HTTPS (Vercel provides this automatically)

### 4. Test Installation

1. Visit your production URL
2. Try installing on mobile device
3. Test offline by turning off wifi
4. Verify app shortcuts work

## 🎨 Customizing the PWA

### Update App Name

Edit `public/manifest.json`:
```json
{
  "name": "Your Company Name - CrewAI",
  "short_name": "YourCrew",
  ...
}
```

### Change Theme Color

Edit `public/manifest.json` and `index.html`:
```json
"theme_color": "#YOUR_COLOR"
```

### Add More Shortcuts

Edit `public/manifest.json`:
```json
"shortcuts": [
  {
    "name": "Your Feature",
    "url": "/your-route",
    ...
  }
]
```

## 🧪 Testing PWA Features

### Lighthouse Audit

1. Open Chrome DevTools (F12)
2. Go to "Lighthouse" tab
3. Select "Progressive Web App"
4. Click "Generate report"
5. Aim for 100% PWA score!

### Test Service Worker

1. Open Chrome DevTools → Application tab
2. Click "Service Workers" in sidebar
3. Verify your service worker is registered
4. Test "Offline" checkbox to simulate offline mode

### Test Manifest

1. Open Chrome DevTools → Application tab
2. Click "Manifest" in sidebar
3. Verify all icons and metadata appear correctly

## 📱 PWA Checklist

- ✅ Manifest.json configured
- ✅ Service worker registered
- ✅ HTTPS enabled (in production)
- ⏳ Icons created (192x192, 512x512)
- ⏳ Tested on mobile device
- ⏳ Tested offline functionality
- ⏳ Lighthouse PWA score > 90%

## 🐛 Troubleshooting

**"Install" button doesn't appear:**
- Check console for errors
- Verify manifest.json is accessible
- Ensure you're on HTTPS (production) or localhost
- Try hard refresh (Ctrl+Shift+R)

**Service worker not registering:**
- Check console for registration errors
- Verify `/sw.js` is in public folder
- Clear browser cache and reload

**Icons not showing:**
- Verify icon files exist in `/public/`
- Check file names match manifest.json exactly
- Clear cache and reinstall

**App doesn't work offline:**
- Service worker needs to cache visited pages first
- Visit pages while online, then test offline
- Check service worker cache in DevTools

## 🎉 Success!

Once installed, CrewAI will:
- Open in standalone window (no browser UI)
- Appear in app launcher/home screen
- Work partially offline
- Feel like a native app
- Support app shortcuts

Perfect for superintendents and foremen in the field! 🏗️
