# Google Drive Setup Guide for BCM Writer

This guide will walk you through setting up your own Google Cloud credentials to enable automatic Google Drive backups in BCM Writer.

---

## Why Do I Need This?

To enable automatic backups to your Google Drive, you need to create your own Google Cloud project and credentials. This is a **one-time setup** that takes about 10 minutes and is completely free for personal use.

**With BCM Writer, YOU own everything:**
- **Total control** - Your Google project, your rules
- **100% private** - Zero third-party access to your writing
- **Always free** - Personal use never costs a penny
- **Set once, write forever** - 10 minutes now = peace of mind forever

---

## The 6-Step Setup Process

### Step 1: Build Your Writing Fortress

1. Visit [Google Cloud Console](https://console.cloud.google.com)
2. Sign in with your Google account
3. Click **"Select a project"** at the top → **"New Project"**
4. Name it **"BCM Writer"** (or get creative!)
5. Click **"Create"** and watch the magic happen

---

### Step 2: Unlock Drive Powers

1. Navigate to **"APIs & Services"** → **"Library"**
2. Search for **"Google Drive API"**
3. Click it, then smash that **"Enable"** button
4. Wait a moment while it activates

---

### Step 3: Set Your Security Preferences

1. Go to **"APIs & Services"** → **"OAuth consent screen"**
2. Select **"External"** → **"Create"**
3. Fill in the essentials:
   - **App name**: BCM Writer
   - **User support email**: Your email
   - **Developer contact**: Your email again
4. **"Save and Continue"**
5. On **Scopes**, click **"Add or Remove Scopes"**
6. Find and select: **`https://www.googleapis.com/auth/drive.file`**
   - This lets the app ONLY touch files it creates (maximum privacy!)
7. **"Update"** → **"Save and Continue"**
8. **"Save and Continue"** through Test users (skip this part)
9. **"Back to Dashboard"**

---

### Step 4: Get Your VIP Pass (OAuth Credentials)

1. Head to **"APIs & Services"** → **"Credentials"**
2. **"Create Credentials"** → **"OAuth client ID"**
3. Choose **"Web application"**
4. Name it **"BCM Writer Web Client"**
5. Under **"Authorized JavaScript origins"**, add:
   ```
   https://bigcatmellow.github.io
   ```
6. Under **"Authorized redirect URIs"**, add ALL THREE:
   ```
   https://bcmwriter.goldenjanitors.workers.dev/auth/google/callback
   https://bigcatmellow.github.io
   https://bigcatmellow.github.io/BCMWriter/
   ```
7. Click **"Create"**
8. **TREASURE CHEST ALERT!** Copy these precious gems:
   - **Client ID** (looks like: `xxxxx.apps.googleusercontent.com`)
   - **Client Secret** (looks like: `GOCSPX-xxxxx`)
   - Save these somewhere safe!

---

### Step 5: Forge Your API Key

1. Still in **"Credentials"**, click **"Create Credentials"** → **"API Key"**
2. Your shiny new API key appears!
3. **Copy and save it** (looks like: `AIzaSyxxxxxx`)
4. **(PRO MOVE)** Click **"Restrict Key"**:
   - Choose **"Restrict key"**
   - Select ONLY **"Google Drive API"**
   - **"Save"** for maximum security

---

### Step 6: Connect Everything & Start Writing!

You now have **3 magic keys** to unlock cloud powers:

**Example Format** (yours will be different):
```
Client ID: 123456789012-abc1def2ghi3jkl4mno5pqr6stu7vwx8.apps.googleusercontent.com
Client Secret: GOCSPX-AbCdEfGhIjKlMnOpQrStUvWxYz
API Key: AIzaSyAbCdEfGhIjKlMnOpQrStUvWxYz1234567
```

**Final Setup in BCM Writer:**

1. Click the **menu button** (hamburger icon) top-left
2. Click **"Setup Google Drive"**
3. Paste your three credentials:
   - Client ID
   - Client Secret  
   - API Key
4. **"Save & Continue"**
5. Sign in when Google asks
6. Pick or create your backup folder
7. **DONE!** Auto-backup every 5 minutes starts NOW

---

## Troubleshooting

### "Access blocked: This app's request is invalid"
- Double-check ALL THREE redirect URIs in Step 4
- Confirm Google Drive API is enabled in Step 2

### "API key not valid"
- No extra spaces when you copied it
- If restricted, make sure it's ONLY Google Drive API

### "Client secret mismatch"
- Copy the complete secret (easy to miss characters)
- Try creating fresh credentials if it still fails

### Still Stuck?
1. Check URIs match EXACTLY (no typos!)
2. Verify Google Drive API shows "Enabled"
3. Create brand new credentials
4. Press F12 → Check console for detailed errors

---

## Security & Privacy

- Your credentials are stored only in your browser
- The app only requests access to files it creates (`.../auth/drive.file` scope)
- No server stores your writing content
- You can disconnect and clear credentials anytime
- Your own Google Cloud project = nobody else can touch your data

---

## What You Get

Once setup is complete:
- **Local auto-save** as you type
- **Cloud backup** every 5 minutes
- **Persistent login** for months (with Client Secret)
- **Cross-device sync** - load your work anywhere
- **Manual backup** option for instant saves

---

## Quick Reference

**Required Scope:**
- `https://www.googleapis.com/auth/drive.file`

**Required URIs:**
- **JavaScript Origin**: `https://bigcatmellow.github.io`
- **Redirect URIs**: 
  - `https://bcmwriter.goldenjanitors.workers.dev/auth/google/callback`
  - `https://bigcatmellow.github.io`
  - `https://bigcatmellow.github.io/BCMWriter/`

---

**Need more help?** Check the [main README](README.md) for general information about BCM Writer, or press F12 in your browser to check the console for error messages.

---

<div align="center">

**Write More. Worry Less. Create Fearlessly.**

[Back to Main README](README.md)

</div>