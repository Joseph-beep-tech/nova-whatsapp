# Git Commit Rules

## Commit Message Workflow

**IMPORTANT**: Do NOT automatically commit and push changes.

When work is complete and ready to commit:

1. **Batch by concern** - Group related changes into separate commits. Stage and commit config fixes, new features, docs, and test updates as distinct commits. Never lump unrelated changes into a single commit.
2. **Output the commit message** - Show the proposed commit message to the user
3. **Wait for approval** - Let the user review and decide whether to commit
4. **Do NOT run** `git commit` or `git push` automatically

### Commit Message Format

Use conventional commit format:
```
<type>(<scope>): <short description>

<body - optional detailed explanation>

Signed-off-by: Kago Kagichiri <kago.kagichiri@gmail.com>
Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
```

### Types
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation only
- `refactor`: Code refactoring
- `chore`: Maintenance tasks
- `test`: Adding tests

### Example Output

When ready to commit, output like this:

```
Ready to commit. Proposed commit message:

---
fix(n8n-workflow): correct JSON paths in SOMO registration request

The "Register SOMO User" node was using incorrect paths like
$json.routing.from when the data is at $json.from (top level).

Signed-off-by: Kago Kagichiri <kago.kagichiri@gmail.com>
Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
---

Files to stage:
- n8n-workflows/whatsapp-router.json
- docs/n8n/incidents/2026-01-29-welcome-message-fixes.md

Run `git add <files> && git commit` when ready.
```

## Why This Rule Exists

- Gives user control over when commits happen
- Allows review of commit messages before committing
- Prevents accidental commits of incomplete work
- Lets user batch related changes if needed
