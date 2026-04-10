# LasangPinoy Mobile — Client Demo Setup Guide

This guide walks you through running the **LasangPinoy Mobile** app on your own Windows or macOS laptop for the demonstration. The app will run in a web browser via Expo Web — no Android/iOS device or emulator needed.

Estimated setup time: **15–25 minutes** (most of it is the dependency install).

---

## 1. Install the prerequisites

Install these three tools, in order, before touching the project.

### 1.1 Node.js (LTS)
1. Go to <https://nodejs.org/en/download>.
2. Download the **LTS** installer for your OS (Windows `.msi` or macOS `.pkg`).
3. Run the installer and accept all the default options.
4. Open a **new** terminal (Command Prompt / PowerShell on Windows, Terminal on macOS) and verify:
   ```bash
   node --version
   npm --version
   ```
   You should see version numbers (Node 20+ recommended). If not, reboot and try again.

### 1.2 Git
- **Windows:** download from <https://git-scm.com/download/win> → run installer → keep all defaults.
- **macOS:** open Terminal, run `git --version`. If it prompts to install Xcode Command Line Tools, accept.

Verify:
```bash
git --version
```

### 1.3 A modern browser
Google Chrome, Microsoft Edge, or Firefox. Already installed on most laptops.

---

## 2. Get the project code

Open a terminal and pick a folder where you want the project to live (e.g. your Desktop):

```bash
cd Desktop
git clone https://github.com/burikethhh/PUPLasangpinoy.git
cd PUPLasangpinoy
```

> The `cd PUPLasangpinoy` line moves you **into** the project folder. Every command from here on must be run from inside this folder.

---

## 3. Add the environment file (API keys)

The developer will hand you a file named **`.env.demo`** (via USB, private email, or direct transfer). This file holds the working API keys for the demo.

1. Copy `.env.demo` into the **root of the `PUPLasangpinoy` folder** (the same folder that contains `package.json`).
2. Rename it from `.env.demo` to exactly **`.env`** (note the leading dot, no extension).

   **Windows File Explorer tip:** if you can't see the extension, enable *View → Show → File name extensions*.

   **Command-line rename:**
   - Windows (PowerShell): `Rename-Item .env.demo .env`
   - macOS/Linux: `mv .env.demo .env`

3. Verify the file is there:
   - Windows: `dir /a .env`
   - macOS/Linux: `ls -la .env`

---

## 4. Install project dependencies

Still inside the `PUPLasangpinoy` folder, run:

```bash
npm install
```

This downloads all required packages into a `node_modules` folder. Expect **5–15 minutes** depending on your internet speed. You may see a few `npm warn` lines — that is normal and can be ignored. Only red `ERR!` messages indicate a real problem.

---

## 5. Launch the app in your browser

```bash
npx expo start --web
```

What to expect:
1. The terminal will print a line like `Web is waiting on http://localhost:8081`.
2. Your default browser will **automatically open** the app at that URL.
3. If the browser does not open automatically, manually visit <http://localhost:8081> in Chrome/Edge/Firefox.
4. On first load the page may take 30–60 seconds to compile. Subsequent reloads are fast.

You should now see the LasangPinoy welcome / login screen.

---

## 6. Demo walkthrough

### Sign up as a regular user
1. On the welcome screen click **Sign Up**.
2. Enter any email + password (minimum 6 characters). The email doesn't have to be real.
3. You'll be routed to the main user tabs: Home, Search, Scanner, Chef Pinoy, Profile.

### Log in as Admin
The developer will provide the **admin email and password** verbally or in writing (they are not stored in this repo). Use the **Login** screen and those credentials to access the Admin dashboard, Recipe manager, User manager, Regions, and Categories.

### Features you can try
- **Home / Browse** — scroll traditional Filipino recipes by region.
- **Recipe detail** — tap any recipe to see ingredients, steps, and nutrition.
- **Chef Pinoy** — AI chatbot (Alibaba Qwen / OpenRouter fallback). Ask "How do I cook adobo?"
- **Scanner** — upload a food photo; Google Gemini identifies the dish.
- **Bookmarks** — save favorites from the recipe page.
- **Admin panel** (admin login only) — add/edit/delete recipes, users, regions, categories.

---

## 7. Stopping the app

In the terminal window that is running the server, press **`Ctrl + C`**. Confirm if asked. To start it again later just reopen a terminal, `cd` back into the `PUPLasangpinoy` folder, and run `npx expo start --web` again.

---

## 8. Troubleshooting

| Problem | Fix |
|---|---|
| `'npm' is not recognized` | Node wasn't installed correctly. Close the terminal, reopen a new one, and verify with `node --version`. Reinstall Node if still missing. |
| `'git' is not recognized` | Install Git (step 1.2) and reopen the terminal. |
| `npm install` shows red `ERR!` | Delete `node_modules` and `package-lock.json`, then run `npm install` again. Check your internet connection. |
| Page stuck on "Loading…" | Wait 60 seconds on first load. If still stuck, stop the server (Ctrl+C), run `npx expo start --web -c` (the `-c` clears cache). |
| Browser shows blank white page | Open browser DevTools (F12) → Console tab → screenshot the red errors and send to developer. |
| "Firebase: Error (auth/...)" | The `.env` file is missing, misnamed, or has wrong values. Re-do step 3. |
| Port 8081 already in use | Another Expo/Metro process is running. Close other terminals or reboot. |
| App loads but AI chat / scanner fails | AI keys may have hit daily quota — notify developer. Other features still work. |

---

## 9. What *not* to do

- **Do not** commit or upload the `.env` file anywhere (GitHub, email attachments, chat). It contains private API keys.
- **Do not** share the admin credentials publicly.
- **Do not** run `git push` — you don't need to push anything back from the demo laptop.

---

## 10. Quick reference (cheat sheet)

```bash
# One-time setup
git clone https://github.com/burikethhh/PUPLasangpinoy.git
cd PUPLasangpinoy
# (drop .env file into this folder)
npm install

# Every time you want to run the demo
cd PUPLasangpinoy
npx expo start --web

# To stop
# press Ctrl+C in the terminal
```

---

**Contact:** if anything in steps 1–5 fails, stop and message the developer with a screenshot of the terminal — don't guess, it's usually a 30-second fix.
