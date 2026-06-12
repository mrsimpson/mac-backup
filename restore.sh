#!/usr/bin/env bash
# restore.sh — Main restore script for db-mac-backup
# Sources lib/*.sh, reads .backup-config, dispatches to category handlers.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/lib/utils.sh"
source "$SCRIPT_DIR/lib/brew.sh"

# Parse command-line flags
DRY_RUN=false
SPECIFIC_CATEGORY=""
BACKUP_DEST_OVERRIDE=""
GPG_KEY_OVERRIDE=""
DOTFILES_APPS_OVERRIDE=""
GIT_ROOT_OVERRIDE=""
GENERATE_CONFIG=false

while [[ $# -gt 0 ]]; do
    case "$1" in
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --mode)
            MODE_OVERRIDE="$2"
            shift 2
            ;;
        --category|--categories)
            SPECIFIC_CATEGORY="$2"
            shift 2
            ;;
        --dest)
            BACKUP_DEST_OVERRIDE="$2"
            shift 2
            ;;
        --gpg-key)
            GPG_KEY_OVERRIDE="$2"
            shift 2
            ;;
        --dotfiles-apps)
            DOTFILES_APPS_OVERRIDE="$2"
            shift 2
            ;;
        --git-root)
            GIT_ROOT_OVERRIDE="$2"
            shift 2
            ;;
        --generate-config)
            GENERATE_CONFIG=true
            shift
            ;;
        --help|-h)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --dry-run          Show what would be done without executing"
            echo "  --mode backup|restore  Set mode (overrides config)"
            echo "  --category <name>  Run only this category (homebrew, git, dotfiles, apps, system)"
            echo "  --dest <path>      Override backup/restore destination"
            echo "  --gpg-key <key>    Override GPG key for encryption"
            echo "  --dotfiles-apps <apps>  Space-separated list of dotfiles apps"
            echo "  --git-root <path>       Root directory scanned for git repos"
            echo "  --generate-config  Generate a default .backup-config file"
            echo "  --help, -h         Show this help"
            exit 0
            ;;
        *)
            die "Unknown option: $1"
            ;;
    esac
done

# Generate default config if requested
if [[ "$GENERATE_CONFIG" == true ]]; then
    bash "$(dirname "$0")/backup.sh" --generate-config
    exit 0
fi

export DRY_RUN

# Load config
if ! load_config; then
    die "No configuration found. Run ./wizard.sh first."
fi

# Apply CLI overrides to config variables
if [[ -n "${MODE_OVERRIDE:-}" ]]; then
    MODE="$MODE_OVERRIDE"
fi
if [[ -n "${BACKUP_DEST_OVERRIDE:-}" ]]; then
    BACKUP_DEST="$BACKUP_DEST_OVERRIDE"
fi
if [[ -n "${GPG_KEY_OVERRIDE:-}" ]]; then
    GPG_KEY="$GPG_KEY_OVERRIDE"
fi
if [[ -n "${DOTFILES_APPS_OVERRIDE:-}" ]]; then
    DOTFILES_APPS="$DOTFILES_APPS_OVERRIDE"
fi
if [[ -n "${GIT_ROOT_OVERRIDE:-}" ]]; then
    GIT_ROOT="$GIT_ROOT_OVERRIDE"
fi

# Resolve destination
DEST="$(get_backup_dest)"
# Expand ~ to $HOME
DEST="${DEST/#\~/$HOME}"

# Ensure backup source directory exists
if [[ ! -d "$DEST" ]]; then
    die "Backup directory not found: $DEST"
fi

log_info "============================================"
log_info "  db-mac-backup — Restore"
log_info "============================================"
log_info "Source: $DEST"
if [[ "$DRY_RUN" == "true" ]]; then
    log_info "[DRY-RUN MODE] Nothing will be modified."
fi
log_info ""

# -----------------------------------------------------------------------
# Category dispatch
# -----------------------------------------------------------------------

restore_homebrew() {
    if [[ "${RESTORE_HOMEBREW:-false}" != "true" ]]; then
        log_info "Homebrew restore: SKIPPED (not enabled in config)"
        return
    fi

    brew_restore "$DEST"
}

restore_git() {
    if [[ "${RESTORE_GIT:-false}" != "true" ]]; then
        log_info "Git restore: SKIPPED (not enabled in config)"
        return
    fi

    local git_src="$DEST/git"
    if [[ ! -d "$git_src" ]]; then
        log_warn "Git: backup directory not found at $git_src"
        return
    fi

    log_progress "Git: restoring repo structures..."

    for repo_dir in "$git_src"/*/; do
        if [[ ! -d "$repo_dir" ]]; then
            continue
        fi

        local repo_name
        repo_name="$(basename "$repo_dir")"
        local target_repo="$HOME/projects/$repo_name"

        log_progress "Git: restoring $repo_name..."

        # Restore .git/config
        if [[ -f "$repo_dir/config" ]]; then
            mkdir -p "$target_repo/.git" 2>/dev/null || true
            run_or_dry_run "Git: restoring .git/config for $repo_name" \
                "cp '$repo_dir/config' '$target_repo/.git/config'"
        fi

        # Restore .git/ directory structure
        if [[ -d "$repo_dir/.git" ]]; then
            mkdir -p "$target_repo" 2>/dev/null || true
            run_or_dry_run "Git: restoring .git/ structure for $repo_name" \
                "rsync -av '$repo_dir/.git/' '$target_repo/.git/'"
        fi

        # Apply dirty patches if present
        local patches_dir="$repo_dir/patches"
        if [[ -d "$patches_dir" ]]; then
            if [[ -f "$patches_dir/staged.diff" ]]; then
                log_info "Git: applying staged patch for $repo_name..."
                run_or_dry_run "Git: applying staged patch" \
                    "cd '$target_repo' && git apply --cached '$patches_dir/staged.diff'"
            fi
            if [[ -f "$patches_dir/unstaged.diff" ]]; then
                log_info "Git: applying unstaged patch for $repo_name..."
                run_or_dry_run "Git: applying unstaged patch" \
                    "cd '$target_repo' && git apply '$patches_dir/unstaged.diff'"
            fi
        fi

        # Restore metadata (reference only, not applied)
        if [[ -d "$repo_dir/metadata" ]]; then
            log_info "Git: metadata for $repo_name saved in $repo_dir/metadata/"
        fi
    done
}

restore_dotfiles() {
    if [[ "${RESTORE_DOTFILES:-false}" != "true" ]]; then
        log_info "Dotfiles restore: SKIPPED (not enabled in config)"
        return
    fi

    local dotfiles_src="$DEST/dotfiles"
    if [[ ! -d "$dotfiles_src" ]]; then
        log_warn "Dotfiles: backup directory not found at $dotfiles_src"
        return
    fi

    log_progress "Dotfiles: restoring shell configs..."

    # Restore shell configs
    for f in .zshrc .zshenv .zprofile .bashrc .bash_profile .gitconfig .gitignore_global; do
        if [[ -f "$dotfiles_src/$f" ]]; then
            if confirm_yesno "Restore $f to $HOME/$f?"; then
                run_or_dry_run "Dotfiles: restoring $f" \
                    "cp '$dotfiles_src/$f' '$HOME/$f'"
            fi
        fi
    done

    # Restore .ssh/ (decrypt if encrypted)
    local ssh_src="$dotfiles_src/.ssh"
    if [[ -d "$ssh_src" ]]; then
        local ssh_dest="$HOME/.ssh"
        mkdir -p "$ssh_dest"

        # Check if files are encrypted (.gpg extension)
        local has_encrypted=false
        for gpg_file in "$ssh_src"/*.gpg; do
            if [[ -f "$gpg_file" ]]; then
                has_encrypted=true
                break
            fi
        done

        if [[ "$has_encrypted" == "true" ]]; then
            log_info "Dotfiles: decrypting .ssh/ files..."
            for gpg_file in "$ssh_src"/*.gpg; do
                if [[ -f "$gpg_file" ]]; then
                    local plain_file="${gpg_file%.gpg}"
                    local plain_name
                    plain_name="$(basename "$plain_file")"
                    if confirm_yesno "Decrypt and restore $plain_name to $ssh_dest/ ?"; then
                        run_or_dry_run "Dotfiles: decrypting $plain_name" \
                            "gpg --batch --yes --decrypt --output '$plain_file' '$gpg_file' && rm '$gpg_file'"
                    fi
                fi
            done
        else
            # Plain files
            if confirm_yesno "Restore .ssh/ to $HOME/.ssh/ ?"; then
                run_or_dry_run "Dotfiles: restoring .ssh/" \
                    "rsync -av '$ssh_src/' '$ssh_dest/'"
            fi
        fi
    fi

    # Restore .gnupg/ (decrypt if encrypted)
    local gnupg_src="$dotfiles_src/.gnupg"
    if [[ -d "$gnupg_src" ]]; then
        local gnupg_dest="$HOME/.gnupg"
        mkdir -p "$gnupg_dest"

        # Check if files are encrypted
        local has_encrypted=false
        for gpg_file in "$gnupg_src"/*.gpg; do
            if [[ -f "$gpg_file" ]]; then
                has_encrypted=true
                break
            fi
        done

        if [[ "$has_encrypted" == "true" ]]; then
            log_info "Dotfiles: decrypting .gnupg/ files..."
            for gpg_file in "$gnupg_src"/*.gpg; do
                if [[ -f "$gpg_file" ]]; then
                    local plain_file="${gpg_file%.gpg}"
                    if confirm_yesno "Decrypt and restore $(basename "$plain_file") to $gnupg_dest/ ?"; then
                        run_or_dry_run "Dotfiles: decrypting $(basename "$plain_file")" \
                            "gpg --batch --yes --decrypt --output '$plain_file' '$gpg_file' && rm '$gpg_file'"
                    fi
                fi
            done
        else
            if confirm_yesno "Restore .gnupg/ to $HOME/.gnupg/ ?"; then
                run_or_dry_run "Dotfiles: restoring .gnupg/" \
                    "rsync -av '$gnupg_src/' '$gnupg_dest/'"
            fi
        fi
    fi

    # Restore selected app configs from ~/.config/
    local config_src="$dotfiles_src/.config"
    if [[ -d "$config_src" ]]; then
        log_progress "Dotfiles: restoring app configs from ~/.config/..."
        for app_dir in "$config_src"/*/; do
            if [[ ! -d "$app_dir" ]]; then
                continue
            fi
            local app_name
            app_name="$(basename "$app_dir")"
            local app_dest="$HOME/.config/$app_name"
            if confirm_yesno "Restore $app_name to $app_dest ?"; then
                mkdir -p "$app_dest"
                run_or_dry_run "Dotfiles: restoring $app_name" \
                    "rsync -av '$app_dir/' '$app_dest/'"
            fi
        done
    fi

    # Restore selected app configs from ~/Library/Application Support/
    local app_support_src="$dotfiles_src/app-support"
    if [[ -d "$app_support_src" ]]; then
        log_progress "Dotfiles: restoring app configs from ~/Library/Application Support/..."
        for app_dir in "$app_support_src"/*/; do
            if [[ ! -d "$app_dir" ]]; then
                continue
            fi
            local app_name
            app_name="$(basename "$app_dir")"
            local app_dest="$HOME/Library/Application Support/$app_name"
            if confirm_yesno "Restore $app_name to $app_dest ?"; then
                mkdir -p "$app_dest"
                run_or_dry_run "Dotfiles: restoring $app_name" \
                    "rsync -av '$app_dir/' '$app_dest/'"
            fi
        done
    fi
}

restore_apps() {
    if [[ "${RESTORE_APPS:-false}" != "true" ]]; then
        log_info "Apps restore: SKIPPED (not enabled in config)"
        return
    fi

    log_info "Apps restore: Not yet implemented (Slice 5)"
}

restore_system() {
    if [[ "${RESTORE_SYSTEM:-false}" != "true" ]]; then
        log_info "System restore: SKIPPED (not enabled in config)"
        return
    fi

    log_info "System restore: Not yet implemented (Slice 5)"
}

# -----------------------------------------------------------------------
# Main dispatch
# -----------------------------------------------------------------------

run_restore() {
    local category="$1"
    case "$category" in
        homebrew) restore_homebrew ;;
        git)      restore_git ;;
        dotfiles) restore_dotfiles ;;
        apps)     restore_apps ;;
        system)   restore_system ;;
        *)        log_error "Unknown category: $category" ;;
    esac
}

if [[ -n "$SPECIFIC_CATEGORY" ]]; then
    # Run only the specified category
    run_restore "$SPECIFIC_CATEGORY"
else
    # Run all enabled categories
    for category in homebrew git dotfiles apps system; do
        run_restore "$category"
    done
fi

log_info ""
log_info "============================================"
log_info "  Restore complete!"
log_info "============================================"
