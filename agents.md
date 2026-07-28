# Repository agent instructions

These instructions apply to this repository and all work performed beneath this directory.

## Instruction discovery

Before planning or editing, resolve the current working directory and walk from `$PWD` upward to the filesystem root. Read every readable lowercase `agents.md` encountered on that ancestor chain. Apply the files in root-to-leaf order so broader workspace guidance is loaded first and the nearest repository guidance can refine it. Do not search sibling directories. Deduplicate resolved paths or inodes, avoid symlink cycles, and report unreadable instruction files.

## Keep work synchronized with the remote

Before starting work:

1. Inspect `git status`, the current branch, configured remotes, and the repository default branch.
2. Run `git fetch --all --prune` (or the equivalent safe fetch for the environment).
3. Create the feature branch from the latest remote default branch, not a stale local branch.

While working and again before pushing, fetch the remote and incorporate upstream changes with `git merge` or `git pull` on a clean working tree.

- avoid git rebase in favor of git merge.
- Do not force-push, discard remote commits, rewrite shared history, or bypass required review or CI.

## Resolve Git conflicts semantically

Resolve conflicts by understanding and combining the intent of both sides. Do not mechanically choose `ours`, `theirs`, current, or incoming changes. Reconstruct the conceptually correct result, preserving compatible behavior, invariants, tests, documentation, configuration, and API contracts from both sides. When the two intentions are genuinely incompatible, make the smallest explicit design decision and document it in the pull request.

After resolving conflicts:

1. Review every resolved file from the top, not only the conflict hunks.
2. Run formatters, linters, tests, builds, and other relevant validation.
3. Search the entire worktree for unresolved conflict markers, excluding `.git`, for example:

   ```sh
   grep -RInE '^(<<<<<<<|=======|>>>>>>>)' --exclude-dir=.git .
   ```

4. If any marker or suspicious partial resolution remains, repeat the semantic resolution process from the top and run the checks again.

A conflict is not resolved merely because Git accepts the file; it is resolved only when the merged result is conceptually coherent and validated.

## Change discipline

Keep changes scoped to the task, preserve existing repository conventions, add or update tests when behavior changes, and describe validation and any remaining risk in the pull request.