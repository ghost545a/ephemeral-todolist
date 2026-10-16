# Ephemeral — Minimalist To-Do

A sleek, glassmorphic to-do list that lives **only in memory**. No `localStorage`, no cookies, no backend. Refresh the tab and you get a clean slate. To keep a list, download it as `.json` or `.txt` and import it again later.

## Features

- Add, complete, edit inline (double-click or ✎), and delete tasks, with small animations
- Filter tabs (All / Active / Completed) and **Clear Completed**
- Light/Dark theme that follows your OS and can be switched manually (resets on refresh)
- **Export** as `.json` (`id`, `text`, `completed`) or `.txt` Markdown checklist (`- [ ]` / `- [x]`), with a date-stamped filename
- **Import** `.json`, `.txt`, or `.md` with the button or by dragging a file onto the window, then choose **Replace** or **Merge**
- **Refresh guard**: warns before a refresh/close only when you have tasks you haven't downloaded yet (you can turn it off)
- Toast notifications for downloads, imports, clears, and errors

### Keyboard shortcuts

| Shortcut | Action |
| --- | --- |
| `/` or `Ctrl/⌘ + K` | Focus the new-task input |
| `Ctrl/⌘ + S` | Download the current list as JSON |
| `Enter` / `Esc` (while editing) | Save / cancel the edit |
| `Esc` | Close the import prompt or export menu |

## Project structure

```
index.html   # Markup
style.css    # Theme tokens, glassmorphism, animations
app.js       # In-memory state, import/export, shortcuts
vercel.json  # Clean URLs + security headers
```

No dependencies and no build step.

## Run locally

Open `index.html` directly, or serve the folder:

```bash
npx serve .
# or
python -m http.server 8080
```

## Deploy to Vercel via GitHub

1. **Push to GitHub**
   ```bash
   git init
   git add .
   git commit -m "Ephemeral to-do app"
   git branch -M main
   git remote add origin https://github.com/<you>/<repo>.git
   git push -u origin main
   ```
2. **Import the repo:** go to [vercel.com/new](https://vercel.com/new) and pick your GitHub repository.
3. **Configure the project:**
   - Framework Preset: **Other**
   - Root Directory: `./`
   - Build Command: *(leave empty)*
   - Output Directory: *(leave empty, or `.`)*
4. **Deploy.** Vercel serves the static files and applies the headers in `vercel.json`.
5. **Later updates:** every push to `main` deploys to production, and every pull request gets a preview URL.

Using the CLI instead:

```bash
npm i -g vercel
vercel        # preview deployment
vercel --prod # production deployment
```

## Privacy

Tasks never leave your browser. The only network request is for the Inter web font from Google Fonts. Remove the `<link>` tags in `index.html` and the Google Fonts entries in the CSP if you want the app to make no outside requests at all; it falls back to the system font.
