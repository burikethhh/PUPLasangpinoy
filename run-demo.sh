#!/usr/bin/env bash
# ================================================================
#  LasangPinoy Mobile - Client Demo Bootstrap (macOS / Linux)
# ================================================================
# Usage:
#   1. Place this script and .env.demo in the SAME folder.
#   2. Open Terminal, cd into that folder.
#   3. Run:  bash run-demo.sh
#      (or:  chmod +x run-demo.sh && ./run-demo.sh)
# ================================================================

set -u

# --- Colors (fallback to plain if not a TTY) ---
if [ -t 1 ]; then
    BOLD=$'\033[1m'; RED=$'\033[31m'; GREEN=$'\033[32m'
    YELLOW=$'\033[33m'; CYAN=$'\033[36m'; RESET=$'\033[0m'
else
    BOLD=""; RED=""; GREEN=""; YELLOW=""; CYAN=""; RESET=""
fi

err()  { printf "%s[ERROR]%s %s\n" "$RED" "$RESET" "$*" >&2; }
ok()   { printf "        %sOK%s  %s\n" "$GREEN" "$RESET" "$*"; }
step() { printf "\n%s[%s/6]%s %s\n" "$BOLD$CYAN" "$1" "$RESET" "$2"; }

REPO_URL="https://github.com/burikethhh/PUPLasangpinoy.git"
REPO_DIR="PUPLasangpinoy"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

printf "%s================================================================%s\n" "$BOLD" "$RESET"
printf "%s  LasangPinoy Mobile - Client Demo Bootstrap%s\n" "$BOLD" "$RESET"
printf "%s================================================================%s\n" "$BOLD" "$RESET"
cat <<'EOF'

This script will:
  1. Verify Node.js and Git are installed
  2. Download the project from GitHub
  3. Copy your .env.demo into the project as .env
  4. Install dependencies (5-15 minutes)
  5. Launch the app in your web browser

EOF
read -r -p "Press Enter to begin, or Ctrl+C to cancel..." _

# ---------- Step 1: Node.js ----------
step 1 "Checking for Node.js..."
if ! command -v node >/dev/null 2>&1; then
    err "Node.js is not installed or not on PATH."
    printf "\nInstall the LTS version from:\n    %shttps://nodejs.org/en/download%s\n" "$CYAN" "$RESET"
    printf "After installing, reopen Terminal and run this script again.\n\n"
    exit 1
fi
ok "Node.js $(node --version)"

# ---------- Step 2: Git ----------
step 2 "Checking for Git..."
if ! command -v git >/dev/null 2>&1; then
    err "Git is not installed or not on PATH."
    printf "\nmacOS: run  %sxcode-select --install%s  in Terminal.\n" "$CYAN" "$RESET"
    printf "Linux: use your distro's package manager (e.g. apt install git).\n\n"
    exit 1
fi
ok "$(git --version)"

# ---------- Step 3: Clone or pull ----------
if [ -f "$REPO_DIR/package.json" ]; then
    step 3 "Project folder already exists. Updating..."
    if ( cd "$REPO_DIR" && git pull --ff-only ); then
        ok "Repo up to date"
    else
        printf "        %s[WARN]%s Could not fast-forward. Continuing with existing copy.\n" "$YELLOW" "$RESET"
    fi
else
    step 3 "Cloning project from GitHub..."
    if ! git clone "$REPO_URL" "$REPO_DIR"; then
        err "git clone failed. Check your internet connection and confirm the URL is reachable:"
        printf "    %s\n\n" "$REPO_URL"
        exit 1
    fi
    ok "Cloned into $REPO_DIR"
fi

# ---------- Step 4: .env file ----------
step 4 "Setting up .env file..."
if [ -f ".env.demo" ]; then
    cp ".env.demo" "$REPO_DIR/.env"
    ok ".env.demo copied into project as .env"
elif [ -f "$REPO_DIR/.env" ]; then
    ok "Existing .env already in project folder, keeping it"
else
    err "No .env.demo found next to this script, and no existing .env inside the project folder."
    printf "\nPlease place the .env.demo file given by the developer in the\n"
    printf "same folder as this script, then run it again.\n\n"
    printf "Current script folder:\n    %s\n\n" "$SCRIPT_DIR"
    exit 1
fi

# ---------- Step 5: npm install ----------
cd "$SCRIPT_DIR/$REPO_DIR"
step 5 "Installing dependencies..."
printf "        This step can take 5 to 15 minutes. Please be patient.\n"
printf "        You can safely ignore yellow 'npm warn' messages.\n\n"
if ! npm install; then
    err "npm install failed. Scroll up to see the red error lines."
    printf "        If the error mentions network/ETIMEDOUT, check your internet and re-run.\n\n"
    exit 1
fi
ok "Dependencies installed"

# ---------- Step 6: Launch Expo Web ----------
step 6 "Starting Expo web server..."
cat <<EOF

================================================================
  The app will open in your default web browser in a moment.

  If it does not open automatically, visit:
      http://localhost:8081

  To STOP the server: come back to this Terminal and press Ctrl+C.
================================================================

EOF
exec npx expo start --web
