

# Fix Favicon for Social Sharing (Facebook, WhatsApp)

## Problem

There is still a `public/favicon.ico` file (the old Lovable logo) in the project. Browsers and social platforms (Facebook, WhatsApp) request `/favicon.ico` by default, which overrides the `<link rel="icon">` pointing to `mascot-logo.webp`.

## Fix

### Step 1: Delete `public/favicon.ico`
Remove the old Lovable favicon.ico file so platforms stop picking it up.

### Step 2: Copy uploaded mascot to public as PNG favicon
Copy `user-uploads://AMW_Mascot-3.webp` to `public/favicon.png` for broader compatibility (some crawlers don't support webp favicons).

### Step 3: Update `index.html`
Update the favicon link tags to reference both formats and add a `sizes` attribute:

```html
<link rel="icon" type="image/png" href="/favicon.png">
<link rel="icon" type="image/webp" href="/mascot-logo.webp">
<link rel="apple-touch-icon" sizes="180x180" href="/favicon.png">
```

### Note
After deploying, Facebook/WhatsApp cache old favicons aggressively. You may need to use Facebook's [Sharing Debugger](https://developers.facebook.com/tools/debug/) to force a re-scrape of the URL.

