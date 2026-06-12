#!/usr/bin/env bash
# lib/brew.sh — Homebrew backup and restore functions
# Provides brew_backup() and brew_restore() functions.

# ---------------------------------------------------------------------------
# Homebrew Backup
# ---------------------------------------------------------------------------

brew_backup() {
    local dest="$1"
    local brewfile="$dest/homebrew/Brewfile"

    mkdir -p "$(dirname "$brewfile")"

    if ! command -v brew &>/dev/null; then
        log_warn "Homebrew not found. Skipping brew backup."
        return 1
    fi

    log_progress "Homebrew: dumping packages..."
    run_or_dry_run "Homebrew: running brew bundle dump" \
        "brew bundle dump --file='$brewfile' --force --no-vscode"
}

# ---------------------------------------------------------------------------
# Homebrew Restore
# ---------------------------------------------------------------------------

brew_restore() {
    local dest="$1"
    local brewfile="$dest/homebrew/Brewfile"

    if [[ ! -f "$brewfile" ]]; then
        log_warn "Homebrew: Brewfile not found at $brewfile"
        return 1
    fi

    if ! command -v brew &>/dev/null; then
        log_warn "Homebrew not found. Skipping brew restore."
        return 1
    fi

    log_progress "Homebrew: restoring packages from Brewfile..."

    # Preview first
    run_or_dry_run "Homebrew: previewing brew bundle install" \
        "brew bundle install --file='$brewfile' --dry-run"

    if confirm_yesno "Install all packages from Brewfile?"; then
        run_or_dry_run "Homebrew: installing packages" \
            "brew bundle install --file='$brewfile'"
    else
        log_info "Homebrew restore: cancelled by user"
    fi
}
