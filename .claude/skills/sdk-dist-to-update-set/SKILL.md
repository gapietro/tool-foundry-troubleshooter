---
name: sdk-dist-to-update-set
description: Use when a built Fluent/SDK app (dist/app from now-sdk build) must be hand-carried to an instance as a single update set XML — no SDK auth, no app-repo link, air-gapped target, or a change process that only accepts update set imports. Wraps dist/app into one importable sys_remote_update_set XML. Third-choice path — prefer now-sdk install, then Studio Publish to Update Set.
scope: project
version: 1.0.0
triggers:
  - dist to update set
  - dist
  - air-gapped
  - import update set from xml
  - hand-deploy
  - sys_remote_update_set
tags:
  - sdk
  - deployment
  - update-set
---
# Skill: SDK dist → Update Set XML

> `now-sdk build` emits application files, NOT update sets. This skill wraps
> `dist/app` into one importable update set XML for instances the SDK cannot
> reach. It is the THIRD-choice deploy path — check the ladder first.

## Decision ladder (check in order)

1. **`now-sdk install --alias <alias>`** — the supported path. Use it
   whenever the target instance has SDK auth.
2. **Studio → "Publish to Update Set"** — on any instance where the app is
   already installed. Produces a platform-native update set.
3. **This skill** — only when neither is reachable: air-gapped target,
   customer change process that only accepts update set XML, no app-repo link.

What you give up at tier 3: the SDK's install ordering. Commit ordering
becomes the platform's (`type`-driven). Validate with preview before commit.

## Workflow

1. Build first — the converter reads `dist/app`:

       now-sdk build

2. *(Optional — only if a ServiceNow MCP connection is available)* Enrich
   type labels. Run the converter once without `--type-map` and take the
   table list from its summary output (determinism makes the re-run free),
   then query real labels:

       servicenow_query table=sys_db_object fields=name,label query=nameIN<t1>,<t2>,...

   Write the result as JSON (`{"table_name": "Label", ...}`) and pass it via
   `--type-map` on the final run. Skip this entirely when offline — unmapped
   tables fall back to the raw table name, which previews and commits fine.

3. Convert:

       python3 "<this-skill-dir>/scripts/dist_to_update_set.py" \
         [--dist dist/app] [--out target/<scope>-update-set.xml] \
         [--name "..."] [--type-map labels.json]

   `<this-skill-dir>` is the directory containing this SKILL.md — announced
   as "Base directory for this skill" when the skill loads. In projects that
   pulled the skill via `foundry_add`, it resolves to
   `.claude/skills/sdk-dist-to-update-set/`.

   Check the summary: record count should match expectations; investigate
   any `SKIPPED` lines; a `WARNING: no sys_app record` means the target
   instance must already have the app installed.

4. Import on the target instance: **Retrieved Update Sets → Import Update
   Set from XML** → upload the generated file.

5. **Preview** the retrieved set. Resolve any preview problems before
   committing — "table does not exist" errors usually mean the target lacks
   the app or a required plugin (see the step 3 warning about a missing
   sys_app record). Then **Commit**.

6. Verify: spot-check a few records on the target against `dist/` content.

## Notes (hard-won)

- **Missing `table=` attribute:** the SDK does not always set `table=` on
  `<record_update>` (observed on the `sys_module` record carrying
  `bom.json`). The converter infers the table from the child element name —
  do not "fix" this by requiring the attribute.
- **`state=loaded`** on the `sys_remote_update_set` header is what makes the
  imported set previewable. Anything else imports as a dead row.
- **Determinism:** generated sys_ids are md5-derived from stable inputs.
  Re-running with `--date` pinned produces byte-identical output — safe to
  diff, safe to re-import (repeat imports update rather than duplicate,
  via `update_guid`).
- The converter is python3 stdlib only — no pip installs, works air-gapped.
