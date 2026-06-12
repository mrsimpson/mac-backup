#!/usr/bin/env bash
# lib/utils.sh — Utility functions for db-mac-backup
# Provides logging, config loading/saving, error handling, and user confirmation.

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------

log_prefix() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')]"
}

log_info() {
    echo "$(log_prefix) [INFO] $*"
}

log_warn() {
    echo "$(log_prefix) [WARN] $*" >&2
}

log_error() {
    echo "$(log_prefix) [ERROR] $*" >&2
}

log_progress() {
    echo "$(log_prefix) [PROGRESS] $*"
}

# ---------------------------------------------------------------------------
# Error handling
# ---------------------------------------------------------------------------

die() {
    log_error "$@"
    exit 1
}

# ---------------------------------------------------------------------------
# Config loader / saver (dotenv format, no external parser needed)
# ---------------------------------------------------------------------------

CONFIG_FILE="${CONFIG_FILE:-.backup-config}"

load_config() {
    local config_path="${1:-$CONFIG_FILE}"

    if [[ ! -f "$config_path" ]]; then
        log_warn "Config file not found: $config_path"
        log_info "Run ./wizard.sh to create a configuration."
        return 1
    fi

    # Source the dotenv file. Lines starting with # are ignored (comments).
    # Blank lines are ignored.
    set -a
    # shellcheck disable=SC1090
    source "$config_path"
    set +a

    log_info "Config loaded from $config_path"
    return 0
}

save_config() {
    local config_path="${1:-$CONFIG_FILE}"

    log_info "Saving config to $config_path"
    # The caller is responsible for writing the dotenv content.
    # This function just ensures the directory exists.
    local dir
    dir="$(dirname "$config_path")"
    if [[ ! -d "$dir" ]]; then
        mkdir -p "$dir"
    fi
    return 0
}

# ---------------------------------------------------------------------------
# User confirmation helpers
# ---------------------------------------------------------------------------

confirm_yesno() {
    # $1 = prompt message
    # Returns 0 if user confirms, 1 otherwise.
    local prompt="$1"

    # If --no-confirm flag is set (e.g. in CI or dry-run), auto-confirm.
    if [[ "${NO_CONFIRM:-false}" == "true" ]]; then
        log_info "[auto-confirm] $prompt"
        return 0
    fi

    # Always use stdin — dialog does not work in this terminal environment.
    read -r -p "$prompt [y/N] " answer
    case "$answer" in
        [Yy]*) return 0 ;;
        *)     return 1 ;;
    esac
}

# ---------------------------------------------------------------------------
# Dry-run support
# ---------------------------------------------------------------------------

# If DRY_RUN is set, log what would happen without executing.
run_or_dry_run() {
    # Usage: run_or_dry_run "description" "actual command"
    local description="$1"
    shift
    local cmd="$*"

    if [[ "${DRY_RUN:-false}" == "true" ]]; then
        log_info "[DRY-RUN] Would execute: $cmd"
        return 0
    fi

    log_progress "$description"
    eval "$cmd"
    return $?
}

# ---------------------------------------------------------------------------
# Dependency checks
# ---------------------------------------------------------------------------

check_dependency() {
    # $1 = command name
    if ! command -v "$1" &>/dev/null; then
        die "Required command not found: $1"
    fi
}

check_dialog() {
    if ! command -v dialog &>/dev/null; then
        die "dialog is required but not installed. Install with: brew install dialog"
    fi
}

# ---------------------------------------------------------------------------
# Destination helper
# ---------------------------------------------------------------------------

get_backup_dest() {
    # Returns the configured backup destination, falling back to a default.
    local dest="${BACKUP_DEST:-}"
    if [[ -z "$dest" ]]; then
        # Default: ~/OneDrive/db-mac-backup/
        dest="$HOME/OneDrive/db-mac-backup/"
        log_warn "No BACKUP_DEST configured. Using default: $dest"
    fi
    echo "$dest"
}
