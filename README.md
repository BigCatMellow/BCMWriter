# Big Cat Mellow Writer

A distraction-free writing application with smart productivity features and cloud backup.

## Features

### Writing Experience
- **Distraction-free editor** - Clean, minimal interface with dark theme optimized for long writing sessions
- **Ultra Focus Mode** - Full-screen view that removes all UI elements except your text
- **Floating toolbar** - Context-sensitive formatting options appear when you select text
- **Auto-save** - Your work saves automatically to your browser as you type

### Formatting Tools
- **Bold** (Ctrl+B)
- **Italic** (Ctrl+I) 
- **Underline** (Ctrl+U)
- **Headings** - Convert text to H2 headings
- **Note brackets** (Ctrl+[) - Insert `[ note ]` with proper spacing for inline annotations

### Productivity Tracking
- **Daily word goal** - Set a target and track your progress with a visual countdown
- **Writing statistics** - Real-time word count, character count, and daily progress
- **Today's progress** - See how many words you've written in the current session
- **Automatic daily reset** - Stats reset at midnight to track each new day

### Cloud Backup
- **Google Drive integration** - Automatic backup every 5 minutes
- **Persistent sessions** - Stay logged in for months with refresh token storage
- **Manual backup** - Force an immediate save to Drive
- **Cross-device sync** - Load your document from any device
- **Secure authentication** - Uses OAuth 2.0 with client secret for enhanced security

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| Ctrl+B | Bold |
| Ctrl+I | Italic |
| Ctrl+U | Underline |
| Ctrl+[ | Insert note brackets |
| Ctrl+S | Manual backup (if Drive connected) or download |
| Ctrl+M | Toggle menu |
| Esc | Close menu / Exit focus mode |

## Setup

### Basic Use
1. Open the app and start writing
2. Your work auto-saves to your browser
3. Download your text anytime from the menu

### Google Drive Backup (Optional)
1. Click **Setup Google Drive** in the menu
2. Follow the guided setup to get credentials from Google Cloud Console:
   - Create a new project
   - Enable Google Drive API
   - Create OAuth client ID and API key
3. Choose or create a backup folder
4. Your document will auto-backup every 5 minutes

**Note:** The setup requires a Google Cloud project (free). With client secret configured, you'll stay logged in for months instead of just one hour.

## Storage & Privacy

- **Local storage** - All content saves to your browser automatically
- **Google Drive** - Optional cloud backup (you control the folder)
- **No tracking** - Your writing stays private
- **No account required** - Works immediately without sign-up

## Menu Options

### Google Drive Backup
- Setup/connect to Google Drive
- Set backup folder location
- Load document from Drive
- Manual backup
- Disconnect/clear credentials

### Document
- New document (clears current content)
- Download as .txt file
- Ultra Focus Mode toggle

### Statistics
- Current word and character counts
- Daily goal setting and progress
- Words written today

## Technical Notes

- Built for modern browsers (Chrome, Firefox, Safari, Edge)
- Runs entirely client-side
- Uses Cloudflare Worker for OAuth token refresh
- No server-side storage or processing
- Responsive design works on desktop and mobile

## Tips

- Use **note brackets** (Ctrl+[) for inline TODOs and reminders
- Set a **daily goal** to build consistent writing habits
- Enable **Google Drive backup** to never lose your work
- Use **Ultra Focus Mode** when you need zero distractions

## Known Limitations

- Google Drive backup requires manual credential setup
- Some browser extensions may interfere with keyboard shortcuts
- Works best with stable internet for Drive sync

---

**Version:** 1.0  
**License:** Personal/Educational Use  
**Support:** Check browser console (F12) for error messages if features aren't working
