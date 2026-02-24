# Antigravity Skills – Install & Update

## Update command (after install)

```bash
cd ~/.cursor/mazh-antigravity && git pull && rsync -a --delete skills/ ~/.cursor/skills/
```

## Initial install (if needed)

```bash
mkdir -p ~/.cursor/skills
cd ~/.cursor
git clone https://github.com/mazh-cp/Antigravity.git mazh-antigravity
rsync -a --delete mazh-antigravity/skills/ ~/.cursor/skills/
```

> **Note:** The clone lives at `~/.cursor/mazh-antigravity` (not inside `skills/`) because `rsync --delete` would otherwise remove the clone when syncing `skills/` into `~/.cursor/skills/`.
