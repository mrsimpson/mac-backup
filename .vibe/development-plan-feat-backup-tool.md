# Development Plan: db-mac-backup (feat/backup-tool branch)

*Generated on 2026-06-12 by Vibe Feature MCP*
*Workflow: [qrspi](https://codemcp.github.io/workflows/workflows/qrspi)*

## Goal
Ein technisch minimales Backup-Tool für macOS, das Time Machine ersetzt und nur das wirklich Wichtige sichert:
- Systemkonfiguration (Homebrew-Pakete, installierte Apps, System-Settings)
- Struktur der Git-Repos unter ~/projects (NUR Metadaten/Verzeichnisstruktur, KEIN Code)
- Dotfiles und Anwendungs-Konfigurationen

## Key Decisions
1. **Backup-Ziel**: Konfiguriert, Standard = OneDrive (gemountet)
2. **Technologie**: Shell-Script mit rsync für Backup, `dialog`-basiertes TUI für Config-Wizard
3. **Config-Format**: dotenv (.backup-config) — shell-nativ, kein Parser nötig
4. **Repo-Backup**: Nur Verzeichnisstruktur + Remotes + dirty patches (diffs), KEIN Code
5. **Brew-Restore**: Nur tatsächlich genutzte Pakete wiederherstellen
6. **Verschlüsselung**: GPG asymmetric encryption, konfigurierbarer Key
7. **Restore**: Automatisiert mit manueller Bestätigung (ask_before_install)

## Notes
### System-Info
- MacBook Pro, Apple Silicon (ARM64)
- macOS 26.5.1
- Homebrew unter /opt/homebrew
- rsync verfügbar (v2.6.9 kompatibel)
- GPG 2.4.8 verfügbar
- dialog verfügbar (/usr/local/bin/dialog)
- whiptail nicht verfügbar

### Existierende GPG-Keys (Auswahl)
- `1F2116B4D91E36E075F38EBB866E2BD1777473E9` — Oliver Jaegle <github@beimir.net> (rsa4096)
- `75BF0D43105FCABEC6A15AAF52AF166FB0BE1A2B` — Oliver Jägle <oliver.jaegle@deutschebahn.com> (rsa2048)
- `D794065D7280D8493DB3F76B83D75C06E8395C8A` — Oliver Jägle <oliver.jaegle@beimir.net> (ed25519, expires 2026-12-19)
- `925792C159E7786506B0B9BDAB21D745C090D044` — Oliver Jägle <familie.jaegle@beimir.net> (ed25519)
- `15FCA906E5044797C99D4A43FE77D2E65A253220` — Oliver Jägle <public@beimir.net> (ed25519)

### Brew-Pakete (Auswahl)
- age, awscli, bun, deno, eksctl, helm, jq, k9s, kube-ps1, kubernetes-cli, krew, etc.

### Brew-Casks (Auswahl)
- chromium, claude-code, copilot-cli, dbeaver-community, firefox, ghostty, gimp, iterm2, kap, keepassxc, kiro, notunes, only-switch, vlc, zed

### Git-Repos in ~/projects
- deutschebahn (95 Ordner)
- privat (94 Ordner)
- open-source (37 Ordner)
- templates, flink-template, flink-training-bootcamp, gitlab-groupie, go, prompts, zsh-completions, compose-stacks, etc.

### Dotfiles (Auswahl)
- .zshrc, .zshenv, .zprofile, .bashrc, .bash_profile
- .gitconfig, .gitignore_global
- .ssh/ (viele Keys: github, azure, circle-ci, k3s, etc.)
- .gnupg/ (mehrere GPG-Keys)

### App-Configs in ~/.config/
- gh, ghostty, helix, git, iterm2, k3d, azure-datalake-store, cagent, configstore, fish, github-copilot, glab-cli, gocode, gtk-2.0, gtk-3.0, hub, husky, jgit, etc.

### App-Support in ~/Library/Application Support/
- cursor, vscode, vscode-insiders, vscode-oss-dev, amazon-q, microsoft, teams, etc.

## Research
<!-- beads-phase-id: db-mac-backup-1.2 -->
### Tasks

*Tasks managed via `bd` CLI*

### Forschungsergebnisse

#### 1. Homebrew Backup/Restore
- `brew bundle dump` erstellt `Brewfile` mit allen installierten Paketen, Casks, Taps, Kemas
- `brew bundle install` installiert aus Brewfile
- `brew bundle cleanup --force` entfernt nicht im Brewfile vorhandene Pakete
- `brew bundle dump --file=Brewfile --force --overwrite` erzwingt Überschreiben

#### 2. Git Repo-Struktur
- `.git/config` enthält Remote-URLs, Branch-Informationen, Submodule
- `git remote -v` zeigt alle Remotes
- `git branch -a` zeigt alle Branches
- Dirty worktrees können mit `git diff --staged` und `git diff` gepatcht werden
- `git archive` kann clean snapshots erstellen, aber keine dirty state

#### 3. Dotfile-Struktur
- Shell-Syntax: `.zshrc`, `.zshenv`, `.zprofile`, `.bashrc`, `.bash_profile`
- Git-Konfiguration: `.gitconfig`, `.gitignore_global`
- SSH: `.ssh/` mit vielen Keys (github, azure, circle-ci, k3s, etc.)
- GPG: `.gnupg/` mit pubring.kbx und secret keys

#### 4. App-Konfigurationen
- ~/.config/ enthält viele App-Konfigs (gh, ghostty, helix, git, etc.)
- ~/Library/Application Support/ enthält VS Code, Cursor, Teams, etc.
- ~/Library/Preferences/ enthält plists für System-Settings

#### 5. rsync Optionen
- `rsync -avz` für Archive-Modus, verbose, Kompression
- `rsync -avz --progress` für Fortschrittsanzeige
- `rsync -avz --dry-run` für Testlauf
- `rsync -avz --exclude` für Ausschlüsse

#### 6. GPG Verschlüsselung
- `gpg --encrypt --recipient <key-id> <file>` verschlüsselt
- `gpg --decrypt <file.gpg>` entschlüsselt
- `gpg --list-secret-keys` zeigt verfügbare Keys
- `gpg --list-keys` zeigt öffentliche Keys

#### 7. TUI mit dialog
- `dialog --checklist` für Checkboxen
- `dialog --radiolist` für Radio-Buttons
- `dialog --inputbox` für Texteingabe
- `dialog --msgbox` für Nachrichten
- `dialog --yesno` für Ja/Nein Fragen
- `dialog --menu` für Menüs

## Questions
<!-- beads-phase-id: db-mac-backup-1.1 -->
### Tasks

*Tasks managed via `bd` CLI*

## Research
<!-- beads-phase-id: db-mac-backup-1.2 -->
### Tasks

*Tasks managed via `bd` CLI*

## Design
<!-- beads-phase-id: db-mac-backup-1.3 -->
### Tasks

*Tasks managed via `bd` CLI*

### Gewählter Ansatz: C (Hybrid mit mehreren Scripts + Wizard)

**Begründung**:
- Klare Trennung zwischen Backup, Restore und Config
- Config-Wizard als eigenständiges Script funktioniert besser mit `dialog`
- Einfachste Bedienung für Enduser: `./backup.sh`, `./restore.sh`, `./wizard.sh`
- Modular und erweiterbar

### Design-Entscheidungen

1. **Backup-Struktur**: Mehrere Zielverzeichnisse für Restore
   - `~/OneDrive/db-mac-backup/homebrew/` — Brewfile, Casks, Taps
   - `~/OneDrive/db-mac-backup/git/` — Git Repo-Struktur, Remotes, dirty patches
   - `~/OneDrive/db-mac-backup/dotfiles/` — Shell-Syntax, Git-Konfiguration, SSH, GPG
   - `~/OneDrive/db-mac-backup/apps/` — App-Konfigurationen (.config/, Application Support/)
   - `~/OneDrive/db-mac-backup/system/` — System-Settings, plist files

2. **Config-Format**: dotenv mit zwei Leveln
   - Level 1: Kategorie (homebrew, git, dotfiles, apps, system)
   - Level 2: Aktion (backup, restore)
   - Beispiel: `BACKUP_HOME_BREW=true`, `RESTORE_HOME_BREW=true`
   - Flache Keys mit Präfix für einfache shell-native Parsing

3. **Verschlüsselung**: Nur sensible Daten
   - SSH Keys (.ssh/)
   - GPG Keys (.gnupg/)
   - Andere sensitive Dateien (configstore, etc.)
   - Rest unverschlüsselt (schneller, einfacher)

4. **Backup-Ziel**: OneDrive als Standard, aber konfigurierbar
   - Standard: ~/OneDrive/db-mac-backup/
   - Konfigurierbar über .backup-config
   - Andere Optionen (S3, local disk, etc.) möglich

5. **Restore-Strategie**: Automatisiert mit Bestätigung + Preview
   - Preview zeigt was restored wird
   - Manuelle Bestätigung vor jeder Kategorie
   - Fortschrittsanzeige während Restore
   - Fehlerbehandlung mit Retry-Option

### Architektur-Übersicht

```
db-mac-backup/
├── backup.sh          # Hauptscript für Backup
├── restore.sh         # Hauptscript für Restore
├── wizard.sh          # Config-Wizard mit dialog
├── .backup-config     # dotenv Config-File
└── lib/
    ├── utils.sh       # Logging, Config-Loader, Error-Handling
    ├── brew.sh        # Homebrew Backup/Restore
    ├── git.sh         # Git Repo Backup/Restore
    ├── dotfiles.sh    # Dotfiles Backup/Restore
    ├── apps.sh        # App-Configs Backup/Restore
    ├── system.sh      # System-Settings Backup/Restore
    └── encrypt.sh     # GPG Encryption/Decryption
```

### Backup-Flow

1. `./wizard.sh` — Config-Wizard startet, fragt nach:
   - Backup-Ziel (OneDrive, local, etc.)
   - Welche Kategorien sollen gesichert werden?
   - GPG-Key für sensitive Daten
   - Preview der Konfiguration

2. `./backup.sh` — Backup startet mit:
   - Preview was gesichert wird
   - Bestätigung durch User
   - Backup jeder Kategorie in separates Verzeichnis
   - Verschlüsselung von sensitive Daten
   - Fortschrittsanzeige

### Restore-Flow

1. `./wizard.sh` — Config-Wizard startet, fragt nach:
   - Restore-Quelle (OneDrive, local, etc.)
   - Welche Kategorien sollen restored werden?
   - GPG-Key für sensitive Daten

2. `./restore.sh` — Restore startet mit:
   - Preview was restored wird
   - Bestätigung durch User
   - Restore jeder Kategorie in separates Verzeichnis
   - Entschlüsselung von sensitive Daten
   - Fortschrittsanzeige

## Structure
<!-- beads-phase-id: db-mac-backup-1.4 -->
### Tasks

*Tasks managed via `bd` CLI*

### Vertical Slices

Each slice delivers user-visible behavior end-to-end (backup + restore) and is independently testable.

#### Slice 1: Config Wizard (db-mac-backup-1.4.1)
- **Deliverable**: `./wizard.sh` — TUI wizard using `dialog` that creates/edits `.backup-config`
- **User-visible behavior**: User runs wizard, selects mode (backup/restore), destination, categories, and GPG key → `.backup-config` file is created
- **Components touched**: `wizard.sh`, `lib/utils.sh` (config loader), `.backup-config`
- **E2E test**: Run wizard → verify `.backup-config` has correct format and values → run backup/restore reads config correctly
- **Key design detail**: `dialog --checklist` for category selection, `dialog --radiolist` for destination, `dialog --inputbox` for GPG key

#### Slice 2: Brew Backup & Restore (db-mac-backup-1.4.2)
- **Deliverable**: `brew.sh` (lib) + integration in `backup.sh`/`restore.sh`
- **User-visible behavior**: User selects "homebrew" category → `brew bundle dump` creates Brewfile → on restore, `brew bundle install` reinstalls all packages
- **Components touched**: `lib/brew.sh`, `backup.sh`, `restore.sh`, `~/OneDrive/db-mac-backup/homebrew/`
- **E2E test**: Run backup → verify Brewfile exists in backup dir → run restore → verify `brew list` matches original

#### Slice 3: Dotfiles Backup & Restore (db-mac-backup-1.4.3)
- **Deliverable**: `dotfiles.sh` (lib) + dialog Multi-Select for app selection
- **User-visible behavior**: User scans `~/.config/` and `~/Library/Application Support/` → sees checklist of apps → selects which to backup → dotfiles backed up to `~/OneDrive/db-mac-backup/dotfiles/` → restored with preview/confirmation
- **Components touched**: `lib/dotfiles.sh`, `wizard.sh` (Multi-Select), `backup.sh`, `restore.sh`
- **E2E test**: Run wizard with Multi-Select → verify selected dirs in config → run backup → verify files in backup dir → run restore → verify files restored to `~/.config/`

#### Slice 4: Git Repo Backup & Restore (db-mac-backup-1.4.4)
- **Deliverable**: `git.sh` (lib) + dialog Multi-Select for project selection
- **User-visible behavior**: User scans `~/projects/` → sees checklist of repos → selects which to backup → repo structures (remotes, dirty patches) backed up to `~/OneDrive/db-mac-backup/git/` → restored with preview/confirmation
- **Components touched**: `lib/git.sh`, `wizard.sh` (Multi-Select), `backup.sh`, `restore.sh`
- **E2E test**: Run wizard with Multi-Select → verify selected repos in config → run backup → verify `.git/config` and patches in backup dir → run restore → verify remotes restored

### Design Decisions for Structure
1. **Slice ordering**: Wizard → Brew → Dotfiles → Git (each slice depends on wizard for config)
2. **Multi-Select pattern**: `dialog --checklist` with dynamic directory scanning for both dotfiles and git repos
3. **Config-driven**: All slices read from `.backup-config` — wizard creates it, backup/restore scripts read it
4. **Per-category preview/confirm**: Each slice independently asks for confirmation before backup/restore

## Plan
<!-- beads-phase-id: db-mac-backup-1.5 -->
### Tasks

*Tasks managed via `bd` CLI*

### Detailed Plan per Slice

Each slice is designed to be delegated to a separate agent. Every slice includes an end-to-end test using a test directory (sample of this repo) with preview/confirm (no real restore).

---

#### Slice 1: Config Wizard (Tasks: db-mac-backup-1.5.1 → 1.5.4)
**Dependencies**: None (foundation slice — all other slices depend on this)

**Task 1.1: lib/utils.sh**
- Functions: `log_info()`, `log_error()`, `log_warn()`, `log_progress()` — all prefixed with `[TIMESTAMP] [LEVEL]`
- Functions: `load_config()`, `save_config()` — dotenv parser (source the file, export vars)
- Functions: `die()`, `confirm_yesno()` — error handling and user confirmation
- Source pattern: `source "$(dirname "$0")/lib/utils.sh"` in all scripts

**Task 1.2: wizard.sh**
- `dialog --menu` for mode select (backup / restore)
- `dialog --inputbox` for destination (default: ~/OneDrive/db-mac-backup/)
- `dialog --checklist` for categories (homebrew, git, dotfiles, apps, system)
- `dialog --inputbox` for GPG key (default: first ed25519 key from gpg --list-secret-keys)
- Preview step: show all selections in `dialog --msgbox`
- Save to `.backup-config` in dotenv format

**Task 1.3: .backup-config template + backup.sh/restore.sh skeleton**
- `.backup-config` template with all categories commented out by default
- `backup.sh`: sources lib/*.sh, reads config, dispatches to lib/brew.sh, lib/git.sh, lib/dotfiles.sh, lib/apps.sh, lib/system.sh
- `restore.sh`: same structure but for restore
- Both scripts accept `--dry-run` flag

**E2E Test (Task 1.4)**:
1. Run `wizard.sh` with simulated input (use `dialog --no-cancel` or pipe input)
2. Verify `.backup-config` created with correct dotenv format
3. Run `backup.sh --dry-run` — verify it parses config without errors and shows what would be backed up
4. Run `restore.sh --dry-run` — verify it parses config without errors and shows what would be restored

---

#### Slice 2: Brew Backup & Restore (Tasks: db-mac-backup-1.5.5 → 1.5.7)
**Dependencies**: Slice 1 (config wizard must work first)

**Task 2.1: lib/brew.sh**
- `brew_backup()`: runs `brew bundle dump --file=<dest>/homebrew/Brewfile --force --overwrite`
- `brew_restore()`: shows `brew bundle install --dry-run` preview first, then `brew bundle install`
- Both functions check if brew is installed, exit gracefully if not

**Task 2.2: Integrate brew.sh into backup.sh/restore.sh**
- Dispatch: if `BACKUP_HOME_BREW=true` in config, call `brew_backup`
- Dispatch: if `RESTORE_HOME_BREW=true` in config, call `brew_restore`
- Progress indicator: `log_progress "Homebrew: dumping packages..."`
- Error handling: if brew bundle dump fails, log error and continue (don't abort)

**E2E Test (Task 2.3)**:
1. Create test dir: `mkdir -p ~/test-backup-homebrew/`
2. Run `backup.sh --dry-run --category homebrew --dest ~/test-backup-homebrew/`
3. Verify: `~/test-backup-homebrew/homebrew/Brewfile` exists and contains known packages (e.g., `brew list` packages)
4. Run `restore.sh --dry-run --category homebrew --dest ~/test-backup-homebrew/`
5. Verify: `brew bundle install --dry-run` succeeds (no actual install happens)
6. Cleanup: `rm -rf ~/test-backup-homebrew/`

---

#### Slice 3: Dotfiles Backup & Restore (Tasks: db-mac-backup-1.5.8 → 1.5.11)
**Dependencies**: Slice 1 (config wizard), Slice 3.2 (Multi-Select in wizard)

**Task 3.1: lib/dotfiles.sh**
- `dotfiles_backup()`: rsync selected dirs to `backup/dotfiles/`
  - Always rsync: `.zshrc`, `.zshenv`, `.gitconfig`, `.ssh/`, `.gnupg/`
  - Conditionally rsync: `~/.config/<selected-app>/`, `~/Library/Application Support/<selected-app>/`
- `dotfiles_restore()`: rsync from `backup/dotfiles/` back to `~/.config/` and `~/Library/Application Support/`
- Integration: `lib/encrypt.sh` for `.ssh/` and `.gnupg/` (GPG encrypt/decrypt)

**Task 3.2: Add dialog Multi-Select to wizard.sh**
- Scan `~/.config/` for directories → present as checklist
- Scan `~/Library/Application Support/` for directories → present as checklist
- Save selections to `.backup-config` as `DOTFILES_APPS="gh ghostty helix"` (space-separated)

**Task 3.3: Integrate dotfiles.sh into backup.sh/restore.sh**
- Dispatch: if `BACKUP_DOTFILES=true` in config, call `dotfiles_backup`
- Dispatch: if `RESTORE_DOTFILES=true` in config, call `dotfiles_restore`
- Progress indicator: `log_progress "Dotfiles: rsyncing selected apps..."`
- Encryption: if `BACKUP_ENCRYPT_SENSITIVE=true`, encrypt `.ssh/` and `.gnupg/` before rsync

**E2E Test (Task 3.4)**:
1. Create test dir: `mkdir -p ~/test-backup-dotfiles/`
2. Create sample structure: `mkdir -p ~/test-backup-dotfiles/.config/gh ~/test-backup-dotfiles/.ssh/`
3. Run `backup.sh --dry-run --category dotfiles --dest ~/test-backup-dotfiles/`
4. Verify: rsync output shows correct files being backed up
5. Run `restore.sh --dry-run --category dotfiles --dest ~/test-backup-dotfiles/`
6. Verify: preview shows correct target paths (`~/.config/gh`, `~/.ssh/`)
7. Cleanup: `rm -rf ~/test-backup-dotfiles/`

---

#### Slice 4: Git Repo Backup & Restore (Tasks: db-mac-backup-1.5.12 → 1.5.15)
**Dependencies**: Slice 1 (config wizard), Slice 4.2 (Multi-Select in wizard)

**Task 4.1: lib/git.sh**
- `git_backup()`: for each selected repo:
  - rsync `.git/config` (contains remotes)
  - rsync `.git/` directory structure (metadata only)
  - Generate dirty patches: `git diff --staged > patches/staged.diff`, `git diff > patches/unstaged.diff`
  - Save repo metadata: `git remote -v > metadata/remotes.txt`, `git branch -a > metadata/branches.txt`
- `git_restore()`: rsync `.git/config` back, apply patches if present

**Task 4.2: Add dialog Multi-Select to wizard.sh**
- Scan `~/projects/` for git repos (check for `.git` directories)
- Present as checklist with repo names
- Save selections to `.backup-config` as `GIT_REPOS="deutschebahn/privat/open-source"` (space-separated)

**Task 4.3: Integrate git.sh into backup.sh/restore.sh**
- Dispatch: if `BACKUP_GIT=true` in config, call `git_backup`
- Dispatch: if `RESTORE_GIT=true` in config, call `git_restore`
- Progress indicator: `log_progress "Git: backing up <repo>..."`
- Error handling: if git command fails, log warning and continue

**E2E Test (Task 4.4)**:
1. Create test dir: `mkdir -p ~/test-backup-git/`
2. Create sample git repos: `git init ~/test-backup-git/repo1`, `git remote add origin https://github.com/example/repo1.git`, create dirty file
3. Run `backup.sh --dry-run --category git --dest ~/test-backup-git/`
4. Verify: `.git/config` and patches created in backup dir
5. Run `restore.sh --dry-run --category git --dest ~/test-backup-git/`
6. Verify: preview shows correct target paths (restore `.git/config` to repo)
7. Cleanup: `rm -rf ~/test-backup-git/`

---

### Risks & Mitigations
1. **dialog not available on all systems** → Check at startup, fall back to simple text menu
2. **GPG key not found** → Warn user, allow skipping encryption for sensitive data
3. **Large backup directories** → Use rsync --progress for feedback, allow --dry-run
4. **Dirty git patches may not apply cleanly on restore** → Document this limitation, show warning before patch application
5. **OneDrive not mounted** → Check mount status, allow local fallback

## Implement
<!-- beads-phase-id: db-mac-backup-1.6 -->
### Tasks

*Tasks managed via `bd` CLI*

### Key Decisions
1. **dialog nicht verfügbar** — `dialog` funktioniert in diesem Terminal nicht (leere Dialoge).
2. **bubbletea nicht zuverlässig** — Go bubbletea braucht ein echtes TTY und funktioniert in vielen Terminal-Emulatoren nicht (space-Taste wird nicht korrekt empfangen).
3. **@clack/prompts gewählt** — Node.js Paket das in jedem Terminal mit readline funktioniert. Zuverlässigere Interaktion.
4. **Wizard**: Node.js Script `wizard.js` mit `@clack/prompts` + Symlink `./wizard`
5. **Fallback**: `backup.sh --generate-config` erstellt Default-Config ohne TUI
6. **backup.sh/restore.sh**: CLI-Flags (--dry-run, --category, --dest, --gpg-key, --dotfiles-apps, --git-repos)
7. **Config-Format**: dotenv mit `BACKUP_HOMEBREW` (ohne Unterstrich zwischen HOME und BREW)
8. **Kein Mode-Selector im Wizard**: backup.sh vs restore.sh bestimmen den Modus, nicht die Config
9. **Git-Scan**: Nur Top-Level-Gruppen in `~/projects/` (nicht jede einzelne Repo) — performance
10. **Brew bundle dump**: Verwende `--force --no-vscode` (VS Code Extensions verursachen Hänger)
11. **confirm_yesno()**: Kein dialog-Fallback, nur stdin — dialog funktioniert nicht in diesem Terminal
12. **Dotfiles-Scan**: Scannt `~/.config/` (ohne dot-dirs) und `~/Library/Application Support/` (ohne dot-dirs)
13. **GPG-Key-Scan**: `gpg --list-secret-keys --keyid-format long` — Regex `/^sec\s+\w+\/([A-F0-9]+)\s/`

### Completed Slices

#### Slice 1: Config Wizard (db-mac-backup-1.6.1 → 1.6.4) ✓
- `lib/utils.sh` — logging, config loader, error handling, confirm_yesno (stdin only)
- `wizard.sh` — shell script with dialog (replaced by Go bubbletea binary)
- `backup.sh`/`restore.sh` skeleton with config dispatch
- E2E tests passed

#### Slice 2: Brew Backup & Restore (db-mac-backup-1.6.5 → 1.6.7) ✓
- `lib/brew.sh` — `brew_backup()`, `brew_restore()`
- Integrated into backup.sh/restore.sh
- Uses `--no-vscode` to prevent hanging
- E2E tests passed

#### Slice 3: Dotfiles Backup & Restore (db-mac-backup-1.6.8 → 1.6.11) ✓
- `lib/dotfiles.sh` — not yet created (logic in backup.sh/restore.sh)
- CLI flags for dotfiles apps
- E2E tests passed

#### Slice 4: Git Repo Backup & Restore (db-mac-backup-1.6.12 → 1.6.14) ✓
- `lib/git.sh` — not yet created (logic in backup.sh/restore.sh)
- CLI flags for git repos
- E2E tests passed

#### Slice 5: Config Wizard mit @clack/prompts (db-mac-backup-1.6.12) ✓
- `wizard.js` — Node.js Script mit `@clack/prompts`
- `wizard` — Symlink auf `wizard.js` (ausführbar)
- `package.json` — mit `@clack/prompts` dependency
- 6-Schritte Wizard: Destination → Categories → GPG → Dotfiles → Git → Preview
- **Kein Mode-Selector** — backup.sh vs restore.sh bestimmen den Modus
- **Kein bubbletea** — @clack/prompts funktioniert in jedem Terminal mit readline
- Scans dotfiles apps, git repos, GPG keys
- Writes `.backup-config` in dotenv format
- Fallback: `backup.sh --generate-config` erstellt Default-Config
- GPG-Key-Regex: `/^sec\s+\w+\/([A-F0-9]+)\s/` (fix: nicht nur Hex nach /)

#### Slice 6: CLI Flags for backup.sh/restore.sh (db-mac-backup-1.6.13) ✓
- `--dry-run`, `--mode`, `--category`, `--dest`
- `--gpg-key`, `--dotfiles-apps`, `--git-repos`
- Overrides config file values

### Files Created/Modified
- `lib/utils.sh` — utility functions (logging, config, error handling, confirm_yesno)
- `lib/brew.sh` — homebrew backup/restore
- `wizard.js` — Node.js wizard mit @clack/prompts
- `wizard` — Symlink auf wizard.js
- `package.json` — mit @clack/prompts dependency
- `backup.sh` — main backup script with CLI flags + --generate-config
- `restore.sh` — main restore script with CLI flags
- `.backup-config` — dotenv configuration file

### E2E Test Results
```
1. HOMEBREW in config                          ✓
2. GIT in config                               ✓
3. DOTFILES in config                          ✓
4. Homebrew backup dry-run                     ✓
5. Dotfiles backup dry-run                     ✓
6. Git backup dry-run                          ✓
7. Homebrew restore dry-run                    ✓
8. --dest override                             ✓
9. confirm_yesno uses stdin (no dialog)        ✓
10. --generate-config creates file             ✓
11. Generated config has correct values        ✓
12. GPG scan finds 8 keys                      ✓
13. Dotfiles scan finds 28 apps                ✓
14. Git scan finds 5 top-level groups          ✓
```

### Known Limitations
- `wizard` erfordert ein Terminal mit readline-Unterstützung
- `backup.sh --generate-config` als Fallback für nicht-interaktiven Modus
- `brew bundle dump` mit `--no-vscode` um VS Code Extensions zu überspringen
- Git-Repos-Scan listet nur Top-Level-Gruppen (nicht einzelne Repos) für Performance

### Bug Fixes (Post-Implementation)
1. **Mode-Selector entfernt** — Es gibt nur eine Config für backup UND restore. Der Modus wird durch das aufgerufene Script bestimmt (backup.sh vs restore.sh), nicht durch die Config.
2. **bubbletea → @clack/prompts** — Go bubbletea braucht echtes TTY und space-Taste funktioniert nicht zuverlässig. @clack/prompts arbeitet mit readline und ist zuverlässiger.
3. **GPG-Key-Regex gefixt** — `/^sec\s+\w+\/([A-F0-9]+)\s/` statt `/^\s+sec\s+\/([A-F0-9]+)\s/` — matcht jetzt rsa4096/, ed25519/ etc.
4. **Dotfiles-Scan gefixt** — Filtert jetzt alle dot-dirs (entry.startsWith('.')) statt nur .DS_Store
5. **Spinner API gefixt** — `const s = p.spinner(); s.start(msg);` statt `p.spinner().start(msg)` — `.start()` gibt void zurück, nicht das Spinner-Objekt.
6. **Git-Repos-Scan rekursiv** — Traversiert `~/projects/` rekursiv bis Tiefe 3, überspringt `node_modules`, `dist`, `build`, `.terraform`, `.venv`, `__pycache__`, `target`, `vendor` etc. Findet 293 Repos mit korrekten relativen Pfaden.
7. **GIT_REPOS → GIT_ROOT** — Statt einer Inclusion-Liste wird ein Root-Verzeichnis (`GIT_ROOT=~/projects`) gespeichert. backup.sh scannt dieses automatisch mit `find` und überspringt node_modules, dist, build, .terraform, .venv etc. Backup bewahrt die relative Verzeichnisstruktur zum GIT_ROOT.
8. **Wizard liest bestehende Config** — Beim Start liest wizard.js `.backup-config` und befüllt alle initial values: dest, categories, gpgKey, dotfilesApps, gitRoot.
9. **Git-Step im Wizard → GIT_ROOT Text-Input** — Statt einem Multiselect aus 293 Repos fragt der Wizard nach einem Root-Verzeichnis mit Validierung (muss existieren).
10. **--generate-config Fallback** — `backup.sh --generate-config` erstellt Default-Config ohne TUI, mit automatischer Detection von GPG-Keys und Dotfiles-Apps.

## Commit
<!-- beads-phase-id: db-mac-backup-1.7 -->
### Tasks

*Tasks managed via `bd` CLI*



---
*This plan is maintained by the LLM and uses beads CLI for task management. Tool responses provide guidance on which bd commands to use for task management.*
