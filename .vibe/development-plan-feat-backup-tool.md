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

---

### V1 Design (SUPERSEDED — see V2 below)

V1 used separate `backup.sh`, `restore.sh`, `wizard.sh` shell entry points with `dialog`/`bubbletea`/`@clack/prompts` (0.x). Superseded after usability review identified 3 fundamental problems.

---

### V2 Design — Agreed Direction

#### Core Decisions

| # | Decision | Choice | Rationale |
|---|---|---|---|
| 1 | **Language** | 100% Node.js ESM — no shell scripts | TDD-friendly; shell logic reimplemented as JS modules |
| 2 | **Entry point** | Single `./mac-backup` binary with subcommands | `config` / `backup` / `restore` — one place for everything |
| 3 | **UI library** | `@clack/prompts` 1.5.1 | Reliable readline-based, `autocompleteMultiselect` for dotfiles picker |
| 4 | **Dotfiles scope** | All `.`-prefixed entries in `$HOME` only | No `~/Library/Application Support/`; user sees real paths with size hints |
| 5 | **Dotfiles picker** | `autocompleteMultiselect` — type-to-filter + multi-select | Handles 50+ entries gracefully |
| 6 | **Git backup** | Lightweight: one named subfolder per repo with `meta.json` + `changes.patch` | No `.git/` copying; inspectable; selective restore |
| 7 | **Git restore logic** | If no patch → record remotes only (user clones later). If patch → `git clone` + `git apply` | Clone only when needed to apply dirty state |
| 8 | **Progress display** | Per-category spinner (sequential): Homebrew → Git → Dotfiles | Simple and clean |
| 9 | **Testing** | **vitest** — watch mode, snapshots, coverage | Better DX for iterating on lib modules |

#### File Structure

```
mac-backup                        ← ESM binary (#!/usr/bin/env node), chmod +x
src/
  commands/
    config.js                    ← interactive wizard (dest, categories, gpg, dotfiles, git root)
    backup.js                    ← orchestrates backup, spinner per category
    restore.js                   ← preview + confirm, spinner per category
  lib/
    brew.js                      ← execSync: brew bundle dump / install
    git.js                       ← scan GIT_ROOT, write meta.json + changes.patch per repo
    dotfiles.js                  ← scan $HOME for dot entries, rsync selected paths
    config.js                    ← read/write .backup-config (dotenv)
  test/
    brew.test.js
    git.test.js
    dotfiles.test.js
    config.test.js
package.json                     ← type:module, bin: ./mac-backup, vitest dep
.backup-config                   ← dotenv (gitignored)
```

#### Backup Output Layout

```
$BACKUP_DEST/
  homebrew/
    Brewfile                     ← brew bundle dump output
  git/
    projects__deutschebahn__my-repo/
      meta.json                  ← { path, remotes, branch, hasChanges }
      changes.patch              ← git diff HEAD (only if dirty)
    projects__privat__other-repo/
      meta.json
  dotfiles/
    .zshrc
    .gitconfig
    .ssh/                        ← rsync copy (GPG-encrypted archive)
    .gnupg/                      ← rsync copy (GPG-encrypted archive)
    .config/
      gh/
      ghostty/
```

#### .backup-config Keys (v2)

```dotenv
BACKUP_DEST=~/OneDrive - Deutsche Bahn/mac-backup
GPG_KEY=52AF166FB0BE1A2B
GIT_ROOT=~/projects
DOTFILES_PATHS=.zshrc .zshenv .gitconfig .gitignore_global .ssh .gnupg .config
BACKUP_BREW=true
BACKUP_GIT=true
BACKUP_DOTFILES=true
```

#### Subcommand Flows

**`./db-backup config`**
1. Intro banner
2. `text` → backup destination
3. `autocompleteMultiselect` → which dotfile paths to include (scans `$HOME` for `.*` entries, shows path + file count + size)
4. `text` → GIT_ROOT (validated: must exist)
5. `select` → GPG key (scanned from `gpg --list-secret-keys`)
6. `confirm` → categories (brew / git / dotfiles toggles)
7. Note: config preview
8. Writes `.backup-config`

**`./db-backup backup`**
1. Reads `.backup-config`; aborts if missing with hint to run `config`
2. Spinner: "Homebrew" → runs `brew.js`
3. Spinner: "Git repos" → runs `git.js` (scans GIT_ROOT, writes per-repo folders)
4. Spinner: "Dotfiles" → runs `dotfiles.js` (rsync selected paths)
5. Outro with summary (counts, destination)

**`./db-backup restore`**
1. Reads `.backup-config` + scans backup destination
2. `note` → preview of what will be restored (counts per category)
3. `confirm` → proceed?
4. Spinner per category (same order)
5. Outro with summary

#### Old files deleted ✓
- `backup.sh`, `restore.sh`, `wizard.js`, `wizard` (symlink), `lib/brew.sh`, `lib/utils.sh` — removed before Structure phase

## Structure
<!-- beads-phase-id: db-mac-backup-1.4 -->
### Tasks

*Tasks managed via `bd` CLI*

### Vertical Slices (V2)

Each slice delivers user-visible behavior end-to-end (backup + restore path) and is independently testable. Slices are ordered by dependency — Slice 1 is the foundation all others build on.

---

#### Slice 1 — Config (`./db-backup config`)
- **Deliverable**: Working `db-backup config` subcommand that writes `.backup-config`
- **User-visible behavior**: User runs `./db-backup config` → interactive wizard collects backup destination, dotfile paths (`autocompleteMultiselect`), GIT_ROOT, GPG key, and enabled categories → `.backup-config` written to disk → note confirms values
- **Files touched**: `db-backup` (entry point + subcommand dispatch), `src/commands/config.js`, `src/lib/config.js` (read/write dotenv)
- **Vitest coverage**: `src/lib/config.js` — parse dotenv, write dotenv, round-trip test

#### Slice 2 — Homebrew backup & restore (`./db-backup backup` + `restore` for brew only)
- **Deliverable**: `BACKUP_BREW=true` causes `brew bundle dump` output to be saved; restore reads it and runs `brew bundle install`
- **User-visible behavior**: Spinner "Homebrew packages" appears; `backup/homebrew/Brewfile` is created on backup, `brew bundle install` is invoked on restore
- **Files touched**: `src/commands/backup.js`, `src/commands/restore.js`, `src/lib/brew.js`
- **Vitest coverage**: `src/lib/brew.js` — mock `execSync`, verify correct args, verify file written to expected path

#### Slice 3 — Dotfiles backup & restore
- **Deliverable**: `BACKUP_DOTFILES=true` + `DOTFILES_PATHS` causes selected dot-entries to be rsynced to `backup/dotfiles/`; restore rsyncs back
- **User-visible behavior**: Spinner "Dotfiles"; each configured path copied with progress; SSH/GPG entries GPG-encrypted before write
- **Files touched**: `src/lib/dotfiles.js`, integrated into `backup.js` / `restore.js`
- **Vitest coverage**: `src/lib/dotfiles.js` — given fixture home dir with dot entries, verify correct rsync calls and encrypted archive paths

#### Slice 4 — Git metadata backup & restore
- **Deliverable**: `BACKUP_GIT=true` scans `GIT_ROOT`, writes one subfolder per repo with `meta.json` + optional `changes.patch`; restore prints clone/apply instructions or applies patch
- **User-visible behavior**: Spinner "Git repos (N found)"; per-repo named folders appear in `backup/git/`
- **Files touched**: `src/lib/git.js`, integrated into `backup.js` / `restore.js`
- **Vitest coverage**: `src/lib/git.js` — fixture repo tree with known remotes + dirty file, verify `meta.json` content and `changes.patch` written only when needed

#### Slice 5 — Binary wiring & smoke test
- **Deliverable**: `db-backup` binary correctly dispatches `config` / `backup` / `restore`; unknown subcommands print usage; `--help` works
- **User-visible behavior**: `./db-backup` with no args prints help; wrong subcommand exits non-zero with message
- **Files touched**: `db-backup` entry point, `package.json` (bin field)
- **Vitest coverage**: Integration smoke test — spawn binary as child process, assert exit codes and stdout snippets

### Slice ordering rationale
- Slice 1 first: all other slices depend on `.backup-config` being readable
- Slices 2–4 are independent of each other and can be built in parallel
- Slice 5 last: wires everything together and validates the full binary contract

### Plan Phase Key Decisions
1. **`readConfig` returns `{}` on missing file** — callers (backup.js, restore.js) decide to error; avoids throwing at import time
2. **`execSync` throughout** — no streaming; simpler mocking in vitest; spinner hides latency
3. **Sensitive dotfiles (`.ssh`, `.gnupg`) GPG-encrypted as tar archives** — not plain rsync; encrypted on write, decrypted on restore
4. **`repoFolderName` uses `__` as path separator** — avoids `/` in filesystem names; reversible
5. **`git diff HEAD` for patches** — captures both staged and unstaged in one shot; guard added for repos with no commits
6. **`findGitRepos` hard-coded skip list** — `node_modules`, `dist`, `build`, `.terraform`, `.venv`, `__pycache__`, `target`, `vendor`; avoids false positives in dependency dirs
7. **vitest with `vi.mock('child_process')`** — ESM-compatible mocking; all lib modules use named imports of `execSync` so mocks intercept correctly
8. **No `--dry-run` flag** — the TUI `confirm` prompt before restore serves the same purpose; keeps implementation simpler
9. **`bd` task IDs**: Slice 1 = 1.5.16, Slice 2 = 1.5.17, Slice 3 = 1.5.18, Slice 4 = 1.5.19, Slice 5 = 1.5.20

## Plan
<!-- beads-phase-id: db-mac-backup-1.5 -->
### Tasks

*Tasks managed via `bd` CLI*

### Detailed Plan per Slice (V2)

Each slice maps to one or more `bd` sub-tasks under `db-mac-backup-1.5`. Implementation order: Slice 1 first (foundation), Slices 2–4 independently, Slice 5 last.

---

#### Slice 1 — Config (`src/lib/config.js` + `src/commands/config.js` + `db-backup` entry)
**bd task**: db-mac-backup-1.5.1
**Dependencies**: None

**1.a `src/lib/config.js`**
- `readConfig(filePath)` → parses dotenv file, returns plain object; expands `~` to `$HOME`
- `writeConfig(filePath, obj)` → serialises object to dotenv key=value lines (no quoting needed for simple values)
- `defaultConfigPath()` → returns `path.join(process.env.HOME, '.backup-config')`
- Error: if file missing return `{}` (not throw) — callers decide what to do

**1.b `src/commands/config.js`**
- Uses `@clack/prompts`: `intro`, `text`, `select`, `multiselect`, `confirm`, `note`, `outro`, `isCancel`, `cancel`
- Step 1: `text` — backup destination (default from existing config or `~/OneDrive - Deutsche Bahn/mac-backup`)
- Step 2: `autocompleteMultiselect` — dotfiles picker: scan `$HOME` for `.*` entries (skip `~/Library/`); show label `~/.foo (N files, X KB)`, value `.foo`
- Step 3: `text` — GIT_ROOT (default `~/projects`; validate: `fs.existsSync` after `~` expansion)
- Step 4: `select` — GPG key: run `gpg --list-secret-keys --keyid-format long`, parse with regex `/^sec\s+\w+\/([0-9A-F]+)/m`, build choices array; add "None" option
- Step 5: three `confirm` prompts for BACKUP_BREW / BACKUP_GIT / BACKUP_DOTFILES (default true)
- Step 6: `note` showing config preview
- Step 7: write config via `writeConfig()`; `outro` confirming path written
- Cancel-safe: every prompt result checked with `isCancel()` → `cancel()` + `process.exit(0)`

**1.c `db-backup` binary**
- Shebang: `#!/usr/bin/env node`
- Parse `process.argv[2]` → dispatch to `config.js`, `backup.js`, `restore.js`
- Unknown subcommand or no args → print usage and `process.exit(1)`
- `chmod +x` must be set; add `"bin": {"db-backup": "./db-backup"}` to `package.json`

**1.d `src/test/config.test.js`** (vitest)
- Round-trip: `writeConfig` → `readConfig` → assert equality
- Tilde expansion: `BACKUP_DEST=~/foo` → resolved to `/Users/<user>/foo`
- Missing file: `readConfig('/nonexistent')` returns `{}`

---

#### Slice 2 — Homebrew (`src/lib/brew.js` + wired into backup/restore)
**bd task**: db-mac-backup-1.5.2
**Dependencies**: Slice 1 (`readConfig`)

**2.a `src/lib/brew.js`**
- `backupBrew(dest)` → runs `brew bundle dump --force --no-vscode --file=<dest>/homebrew/Brewfile`; uses `execSync` with `stdio: 'inherit'`; creates `dest/homebrew/` with `fs.mkdirSync({recursive:true})` first
- `restoreBrew(dest)` → runs `brew bundle install --file=<dest>/homebrew/Brewfile`
- Both functions: guard — if `dest/homebrew/Brewfile` missing on restore, throw descriptive error
- Export: named exports only (no default)

**2.b `src/test/brew.test.js`** (vitest)
- Mock `child_process.execSync` and `fs`
- `backupBrew`: assert correct brew args, assert `mkdirSync` called with correct path
- `restoreBrew`: assert `brew bundle install` args; assert error thrown when Brewfile absent

---

#### Slice 3 — Dotfiles (`src/lib/dotfiles.js` + wired into backup/restore)
**bd task**: db-mac-backup-1.5.3
**Dependencies**: Slice 1 (`readConfig`)

**3.a `src/lib/dotfiles.js`**
- `scanDotfiles(homeDir)` → `fs.readdirSync(homeDir)`, filter entries starting with `.`, skip `~/Library`, return array of `{ name, label, fileCount, sizeKb }`
- `backupDotfiles(paths, homeDir, dest)` → for each path in `paths`:
  - Sensitive paths (`.ssh`, `.gnupg`): create GPG-encrypted tar archive (`tar czf - <path> | gpg --encrypt --recipient <GPG_KEY> > <dest>/dotfiles/<name>.tar.gz.gpg`)
  - Others: `rsync -a --delete <homeDir>/<path> <dest>/dotfiles/`
- `restoreDotfiles(dest, homeDir, gpgKey)` → reverse: decrypt + extract sensitive archives; rsync others back
- All `execSync` calls — no streaming

**3.b `src/test/dotfiles.test.js`** (vitest)
- Fixture: temp dir with `.zshrc`, `.gitconfig`, `.ssh/id_ed25519`
- Mock `execSync`; assert correct rsync args for non-sensitive
- Assert GPG tar pipeline args for `.ssh` and `.gnupg`
- `scanDotfiles`: assert `~/Library` skipped; assert label format

---

#### Slice 4 — Git metadata (`src/lib/git.js` + wired into backup/restore)
**bd task**: db-mac-backup-1.5.4
**Dependencies**: Slice 1 (`readConfig`)

**4.a `src/lib/git.js`**
- `findGitRepos(root, maxDepth=4)` → recursive `fs.readdirSync` walk; a directory is a repo if it contains `.git`; skip `node_modules`, `dist`, `build`, `.terraform`, `.venv`, `__pycache__`, `target`, `vendor`; return array of absolute paths
- `repoFolderName(repoPath, root)` → replace `/` with `__` on the relative path, e.g. `projects/deutschebahn/my-repo` → `projects__deutschebahn__my-repo`
- `backupRepo(repoPath, dest)`:
  1. `git -C <repoPath> remote -v` → parse into `{ name: url }` map
  2. `git -C <repoPath> rev-parse --abbrev-ref HEAD` → branch name
  3. `git -C <repoPath> status --porcelain` → non-empty = dirty
  4. If dirty: `git -C <repoPath> diff HEAD` → `changes.patch`
  5. Write `<dest>/git/<folderName>/meta.json` with `{ path, remotes, branch, hasChanges }`
  6. Write `<dest>/git/<folderName>/changes.patch` only if dirty
- `backupAllRepos(root, dest)` → `findGitRepos` → `backupRepo` for each; returns `{ count, dirtyCount }`
- `restoreRepo(repoBackupDir, targetRoot)`:
  - Read `meta.json`
  - If `hasChanges`: `git clone <origin> <targetPath>` + `git apply <changes.patch>`
  - If no changes: write `<targetPath>/.restore-instructions.txt` with clone command
- Export: named exports

**4.b `src/test/git.test.js`** (vitest)
- Fixture: temp dir with two bare repos (one clean, one with uncommitted change)
- Mock `execSync` where needed for remote commands; use real `fs` on temp dirs
- Assert `meta.json` written with correct structure
- Assert `changes.patch` written for dirty repo, absent for clean repo
- Assert `repoFolderName` path-to-folder name conversion

---

#### Slice 5 — Backup & Restore orchestrators + binary smoke test
**bd task**: db-mac-backup-1.5.5
**Dependencies**: Slices 1–4

**5.a `src/commands/backup.js`**
- `readConfig()` → if empty / no BACKUP_DEST: `log.error(...)` + hint `run ./db-backup config` + `process.exit(1)`
- `spinner` per category (sequential):
  1. If `BACKUP_BREW=true` → spinner "Homebrew packages" → `backupBrew(dest)` → spinner stop with count
  2. If `BACKUP_GIT=true` → spinner "Git repos" → `backupAllRepos(GIT_ROOT, dest)` → stop with `N repos (M dirty)`
  3. If `BACKUP_DOTFILES=true` → spinner "Dotfiles" → `backupDotfiles(paths, HOME, dest)` → stop
- `outro` with summary line: destination + timestamp

**5.b `src/commands/restore.js`**
- Same config guard as backup.js
- Scan dest for what's present (check subdirs `homebrew/`, `git/`, `dotfiles/`)
- `note` preview: list what will be restored with file counts
- `confirm` → if declined, `outro("Nothing restored.")` + exit 0
- Spinners in same order as backup; each calls the corresponding restore function

**5.c `src/test/integration.test.js`** (vitest)
- Spawn `./db-backup` with no args → assert exit code 1, stdout includes `Usage`
- Spawn `./db-backup unknown` → assert exit code 1, stdout includes `Unknown`
- Spawn `./db-backup --help` → assert exit code 0 (if implemented) or 1 with usage
- Note: these tests do NOT run actual backup/restore; they only test binary dispatch

---

### Implementation order
1. `db-mac-backup-1.5.1` — Slice 1: config lib + wizard + binary skeleton + vitest setup
2. `db-mac-backup-1.5.2` — Slice 2: brew lib + tests (can start once Slice 1 `readConfig` exists)
3. `db-mac-backup-1.5.3` — Slice 3: dotfiles lib + tests (parallel with Slice 2)
4. `db-mac-backup-1.5.4` — Slice 4: git lib + tests (parallel with Slices 2–3)
5. `db-mac-backup-1.5.5` — Slice 5: orchestrators + smoke tests (after all libs done)

### Risks & Mitigations
| Risk | Mitigation |
|------|-----------|
| `autocompleteMultiselect` from `@clack/prompts` 1.5.1 has breaking API differences | Inspect actual export shape before wiring; fall back to `multiselect` if needed |
| GPG encryption pipeline (`tar \| gpg`) on macOS may need `--batch --yes` flags | Test on dev machine before writing final args |
| `git diff HEAD` on repo with no commits throws | Guard: check `git rev-parse HEAD` first; skip patch if no commits |
| rsync of `~/.ssh` includes sockets/pipes which rsync rejects | Add `--exclude='*.sock'` to rsync args |
| ~350 repos × `execSync` may be slow (>30 s) | Add count progress to spinner message; cap depth at 4 |
| vitest ESM interop with `child_process` mocks | Use `vi.mock('child_process')` with `vi.fn()`; verify with `npm test` before submitting |

## Implement
<!-- beads-phase-id: db-mac-backup-1.6 -->
### Tasks

*Tasks managed via `bd` CLI*

### Slice 1 V2 — Config (TDD London School) — COMPLETED ✓
**Tasks**: db-mac-backup-1.6.15 through db-mac-backup-1.6.20 (all closed)

**Files created**:
- `src/lib/config.js` — `readConfig`, `writeConfig`, `defaultConfigPath`; tilde expansion, missing-file → `{}`
- `src/test/config.test.js` — 8 vitest tests (TDD: written first, then made green)
- `src/commands/config.js` — interactive wizard with `@clack/prompts` 1.5.1
- `db-backup` — ESM binary, `chmod +x`, dispatches `config`/`backup`/`restore`
- `package.json` — updated with `vitest ^3.0.0`, `bin: {db-backup}`, `test`/`test:watch` scripts

**Test results**: 8/8 pass (`npm test`)

**Smoke test**:
- `node db-backup` → prints Usage, exits 1 ✓
- `node db-backup unknown` → prints Usage, exits 1 ✓

**`@clack/prompts` 1.5.1 API discoveries**:
- `autocompleteMultiselect` is a named export from `@clack/prompts`
- Signature: `autocompleteMultiselect({ message, options, initialValues?, placeholder?, maxItems?, validate?, filter? })`
- `options` = `Array<{ value, label?, hint?, disabled? }>`
- `initialValues` (plural) not `initialValue` — pre-selects multiple items
- Returns `Promise<Value[] | symbol>`
- dist is at `dist/index.mjs` (not `dist/index.js`)

### Slice 2 V2 — Homebrew (TDD London School) — COMPLETED ✓
**Task**: db-mac-backup-1.5.17 (closed)

- `src/lib/brew.js` — `backupBrew(dest)`, `restoreBrew(dest)`; guards for missing Brewfile
- `src/test/brew.test.js` — 4 tests: mkdirSync called, brew bundle dump args, restore args, throws on missing Brewfile

**ESM mock pattern confirmed**: `vi.hoisted` + `vi.mock('fs', async (importOriginal) => { ... spread actual ... })` — spreads original to keep other exports intact while overriding `mkdirSync`/`existsSync`.

### Slice 3 V2 — Dotfiles (TDD London School) — COMPLETED ✓
**Task**: db-mac-backup-1.5.18 (closed)

- `src/lib/dotfiles.js` — `scanDotfiles`, `backupDotfiles`, `restoreDotfiles`
- `src/test/dotfiles.test.js` — 12 tests: scan excludes .Trash/.Library, label format, rsync for non-sensitive, GPG tar for .ssh/.gnupg, restore decrypts .tar.gz.gpg
- `scanDotfiles` tests use REAL temp dirs; `backupDotfiles`/`restoreDotfiles` tests mock only `child_process`
- `gpgKey` param in `restoreDotfiles` is accepted but unused for decrypt (GPG uses local keyring)

### Slice 4 V2 — Git metadata (TDD London School) — COMPLETED ✓
**Task**: db-mac-backup-1.5.19 (closed)

- `src/lib/git.js` — `findGitRepos`, `repoFolderName`, `backupRepo`, `backupAllRepos`, `restoreRepo`
- `src/test/git.test.js` — 10 tests: findGitRepos with real fs (creates actual .git dirs), repoFolderName, backupRepo writes meta.json + changes.patch for dirty, clean repos skip patch, restoreRepo with/without changes
- `backupAllRepos` is **sync** (not async) — `restoreRepo` is async
- `restoreRepo` tests use `await` — spec marked it async
- `backupRepo` writes `.restore-instructions.txt` to `repoBackupDir` (not targetPath) when no changes — targetPath may not exist

### Slice 5 V2 — Orchestrators + Smoke Tests (TDD London School) — COMPLETED ✓
**Task**: db-mac-backup-1.5.20 (closed)

- `src/commands/backup.js` — `runBackup()`: reads config, spinners for brew/git/dotfiles, each wrapped in try/catch
- `src/commands/restore.js` — `runRestore()`: scans dest, note preview, confirm prompt, spinners
- `src/test/integration.test.js` — 3 smoke tests: no args → exit 1 + stdout "Usage", unknown cmd → exit 1
- Integration tests spawn binary via `spawnSync('node', [binaryPath])` — no TTY needed for dispatch-level tests
- `db-backup` uses `console.log` (stdout) for usage — `result.stdout.toContain('Usage')` works correctly
- `backupAllRepos` called without `await` (it's sync)

### Final Test Counts (V2)
| File | Tests | Status |
|------|-------|--------|
| config.test.js | 8 | ✓ |
| brew.test.js | 4 | ✓ |
| dotfiles.test.js | 12 | ✓ |
| git.test.js | 18 | ✓ |
| integration.test.js | 3 | ✓ |
| shell.test.js | 8 | ✓ |
| **Total** | **53** | **all pass** |

### Key Decisions (V2 — Node.js ESM implementation)
14. **`autocompleteMultiselect` uses `initialValues` (plural)** — not `initialValue`; accepts `Value[]` for pre-selection
15. **`db-backup` binary uses top-level `await` for dynamic imports** — works in Node.js ESM without wrapper IIFE
16. **`readConfig` splits on first `=` only** — handles values with `=` in them (URLs, base64, etc.)
17. **`writeConfig` creates parent directory** — uses `mkdirSync({recursive:true})` so first-run always works
18. **`vi.hoisted` + spread of actual fs** — spreads original `fs` exports to preserve `readFileSync` etc., only override `mkdirSync`/`existsSync`
19. **`restoreRepo` writes `.restore-instructions.txt` to backup dir** — not to targetPath (which may not exist); contains the clone command
20. **`backupAllRepos` is sync** — plain function returning `{ count, dirtyCount }`, no async needed
21. **Integration tests use `spawnSync`** — no TTY needed for dispatch-layer smoke tests; command files dynamically imported only on valid subcommands
22. **No GPG encryption in V1** — `.ssh` and `.gnupg` backed up with plain rsync like all other dotfiles; backup destination (OneDrive) is assumed trusted. `GPG_KEY` config key removed. `scanGpgKeys()` removed from config wizard. Rationale: encryption added fragile GPG dependency with no benefit for the primary use-case (personal OneDrive backup). Can be added in V2 as an opt-in flag.
24. **Shell-quote all paths with `q()` helper** — `src/lib/shell.js` exports `q(p)` which wraps any path in single-quotes and escapes embedded single-quotes with `'\''`. Applied to every path interpolated into brew/rsync/git shell commands. Fixes silent breakage when `BACKUP_DEST` contains spaces (e.g. `OneDrive - Deutsche Bahn`). Also fixed tilde expansion regex in `backup.js`: `/^~(?=\/|$)/` instead of `.replace('~', home)`.
25. **Ctrl+C / SIGINT handling — use async `spawn` not `execSync`** — `execSync` and all sync variants block the Node event loop; no signal handlers can fire during them. The only correct fix is to use async `spawn` for all long-running processes (brew, rsync, git bundle) so the event loop stays alive. `src/lib/shell.js` exports `run(cmd, args)` (spawn-based, returns Promise) and `runSync` (re-exported `execSync`, used only for fast git metadata queries <100ms). When Ctrl+C is pressed, the terminal sends SIGINT to the whole foreground process group; the child dies; the `spawn` `close` event fires with `signal='SIGINT'`; the Promise rejects with `err.signal='SIGINT'`; the `runStep()` helper re-throws it; the top-level `catch` calls `process.exit(130)`. Test mock pattern: `mockSpawn.mockImplementation(() => makeChild(0))` — must use `mockImplementation` (not `mockReturnValue`) so each `spawn()` call gets a fresh EventEmitter; reusing one EventEmitter causes timeout because `close` was already emitted.
31. **rsync SIGKILL from OneDrive + "skipping" stderr noise** — OneDrive's `fileproviderd` sends SIGKILL to rsync when it does large bulk transfers to the sync folder. This is a macOS file provider limitation, not a user abort. Fix: (1) rsync stderr piped away (`stdio: ['inherit', 'inherit', 'pipe']`) — suppresses "skipping non-regular file" warnings for remaining socket-like files that rsync skips silently with exit 0; (2) `runStep()` only re-throws `SIGINT` (Ctrl+C) — all other signals including `SIGKILL` are treated as non-fatal: logged and execution continues to next step. The backup is still considered partially successful.
30. **rsync `mkstempsock: Invalid argument` on OneDrive** — `rsync -a` expands to `-Dgloprt`; `-D` = `--devices --specials`. On macOS's `openrsync`, `--specials` causes it to attempt copying Unix socket files (e.g. `~/.gnupg/S.gpg-agent`, `~/.ssh/*.sock`) to the destination. OneDrive (FUSE/cloud filesystem) does not support socket files and returns `Invalid argument` from `mkstempsock`, causing rsync exit code 23. Fix: replace `-a` with `-rlptgo` (all of `-a` except `-D`) in both `backupDotfiles` and `restoreDotfiles`. Socket files have no meaningful content and should never be backed up.
29. **Per-repo progress during git backup** — `backupAllRepos` now accepts an optional `onProgress(info)` callback called after each repo with `{ repo, index, total, folderName, hasChanges, hasUnpushedCommits, remoteCount }`. In `backup.js` the callback calls `p.log.step(shortName + badge)` (persistent line, `◆` prefix) and `gitSpinner.message(`Git repos — ${index+1}/${total}`)` (updates spinner label mid-spin). Repo folder name `__` separators are converted back to `/` for display. Badges: `[dirty]`, `[unpushed]`, or both. Final spinner stop shows totals.
28. **`execSync` default stdio leaks stderr to terminal** — `execSync` with only `{ encoding: 'utf8' }` uses `pipe` for stdout but **inherits stderr** (passes it straight to the terminal). All `runSync` calls in `git.js` now use `{ encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }` via a shared `syncOpts` constant. This suppresses both `fatal: not a git repository` (from repos that were already filtered but still hit a git command) and `fatal: ambiguous argument 'HEAD'` (from empty repos with no commits). Errors are still caught by try/catch and silently defaulted.
27. **Suppress git/bundle output noise; fix worktree detection** — `findGitRepos` now checks `fs.statSync('.git').isDirectory()` — if `.git` is a file (worktree pointer or submodule), the directory is silently skipped rather than treated as a repo (which caused `fatal: not a git repository` noise). `git bundle create` and restore commands (`unbundle`, `apply`, `checkout`) use `stdio: ['inherit', 'pipe', 'pipe']` so their output is captured and not shown during the spinner. `git clone` on restore keeps `inherit` so the user sees clone progress.
26. **Git bundle for unpushed commits** — `backupRepo` now also runs `git log --branches --not --remotes --oneline`; if non-empty, runs `git bundle create local-commits.bundle --branches --not --remotes` to capture all local-only commits across all branches. `meta.json` gains `hasUnpushedCommits` field. On restore: after cloning from remote, runs `git bundle unbundle local-commits.bundle` to re-import local branches, then `git checkout <branch>` to restore the original branch. `backupAllRepos` return value gains `unpushedCount`. Spinner message shows both dirty and unpushed counts.
23. **No BACKUP_BREW/BACKUP_GIT/BACKUP_DOTFILES boolean flags** — removed the three confirm prompts from the config wizard and the `=== 'true'` guards from backup.js. Rationale: if you've configured a destination, a git root, or selected dotfiles, you always want them backed up — the toggles added friction with no real use-case. Backup is now presence-driven: brew always runs; git runs when `GIT_ROOT` is set; dotfiles runs when `DOTFILES_PATHS` is non-empty. Config file now has only three keys: `BACKUP_DEST`, `DOTFILES_PATHS`, `GIT_ROOT`.
32. **Per-repo detailed logging during git restore** — `restoreRepo` now accepts an `onProgress({ folderName, step, status, detail })` callback emitted after each step (read-meta, clone, unbundle, checkout, apply). Non-skip steps are logged per-repo as indented `p.log.step()` lines (e.g. `  my-org/repo: clone ✓ git@github.com:org/repo.git`). Missing meta.json returns `{ restored: false, skipped: true }` instead of throwing, logged as `[meta.json missing, skipped]`. `restore.js` shows a dedicated spinner with progress counter (N/Total) and a summary line (`X restored, Y skipped, Z errors`). One failing repo never kills the entire restore — errors are collected and reported per-repo.

### Key Decisions (V1 — legacy shell scripts, superseded)
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

### Redesign Decisions (v2 — post-usability review)

After reviewing usability the following fundamental changes were agreed:

#### 1. Single Node.js entry point
- **Old**: `backup.sh`, `restore.sh`, `wizard.js` — three separate entry points with split responsibilities
- **New**: Single `./db-backup` Node.js binary (ESM, shebang) with three subcommands:
  - `./db-backup config` — interactive wizard (create/edit config)
  - `./db-backup backup` — run backup with clack progress + confirmations
  - `./db-backup restore` — run restore with clack preview + confirmations
- All three subcommands use `@clack/prompts` for consistent UX
- Shell scripts (`lib/*.sh`) still handle the actual `rsync`/`brew`/`git` heavy lifting
- Config stays dotenv (`.backup-config`)

#### 2. Git — lightweight metadata file only
- **Old**: rsync entire `.git/` directory structure (expensive, hundreds of MB)
- **New**: Save a JSON metadata file per repo:
  ```json
  { "path": "~/projects/org/repo", "remotes": { "origin": "git@github.com:org/repo.git" }, "diff": "...patch content..." }
  ```
- Dirty state: save as `git diff` + `git diff --staged` patch (only if non-empty)
- On restore:
  - If only remotes (no diff): just record the remote URLs — user can `git clone` later
  - If diff present: `git clone <origin>`, then `git apply <patch>` to restore dirty state
- No `.git/` folder copying at all

#### 3. Dotfiles — all dot-prefixed files/dirs in `$HOME`, nothing else
- **Old**: scan `~/.config/` and `~/Library/Application Support/` by app name (opaque, confusing)
- **New**: scan `$HOME` for all entries starting with `.`
  - Show real paths with file count + size: `~/.zshrc (1 file, 2 KB)`, `~/.ssh/ (12 files, 48 KB)`
  - User selects which to include — contents are `rsync`-copied verbatim
  - No `~/Library/Application Support/` for now
  - Fixed dotfiles always included (never shown in picker, always backed up): `.zshrc`, `.zshenv`, `.zprofile`, `.gitconfig`, `.gitignore_global`

## Commit
<!-- beads-phase-id: db-mac-backup-1.7 -->
### Tasks

*Tasks managed via `bd` CLI*



---
*This plan is maintained by the LLM and uses beads CLI for task management. Tool responses provide guidance on which bd commands to use for task management.*
