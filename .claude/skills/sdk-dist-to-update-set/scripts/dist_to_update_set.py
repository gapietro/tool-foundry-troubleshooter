#!/usr/bin/env python3
"""
dist_to_update_set.py — convert an SDK `dist/app` payload into a single
ServiceNow update set XML that can be loaded via
Retrieved Update Sets -> Import Update Set from XML.

WHY THIS EXISTS
    `now-sdk build` emits application files, NOT update sets: each file in
    dist/app is a bare <record_update table="..."> payload. An update set
    export is a different shape entirely — an <unload> wrapper containing one
    <sys_remote_update_set> header plus one <sys_update_xml> row per record,
    where each row carries the record payload as an XML-ESCAPED string.
    This script performs that wrapping so the app can be hand-carried to an
    instance that has no SDK auth and no app-repo link.

    The supported path is still `now-sdk install`, or Studio ->
    "Publish to Update Set" on an instance where the app is installed. Reach
    for this script only when neither is available.

DETERMINISM
    sys_ids for the generated sys_remote_update_set / sys_update_xml rows are
    derived (md5) from stable inputs, not random — re-running produces a
    byte-identical file apart from unload_date, so output can be diffed and
    re-imported without spawning duplicate retrieved update sets.

USAGE
    python3 dist_to_update_set.py                      # writes to target/
    python3 dist_to_update_set.py --name "My Set" --out /tmp/set.xml
    python3 dist_to_update_set.py --type-map labels.json
"""

import argparse
import hashlib
import json
import sys
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from pathlib import Path

# `type` on sys_update_xml is the human label of the record's table. Verified
# against gpinst01 (sys_db_object.label), and cross-checked against real
# sys_update_xml rows for the tables that had them (sys_security_acl ->
# 'Access Control', sys_script -> 'Business Rule'). Unknown tables fall back to
# the table name, which previews fine — this field drives display and commit
# ordering, not which table the payload is applied to. Extend per app with
# --type-map (JSON object of table name -> label); user entries win.
# 2026-07-23 (#257): +10 high-frequency SDK tables, labels verified live
# against gpinst01 sys_db_object (Zurich Patch 10).
TYPE_BY_TABLE = {
    "sn_aia_agent": "AI Agent",
    "sn_aia_agent_config": "AI Agent Config",
    "sn_aia_agent_tool_m2m": "Agent Tool",
    "sn_aia_team": "Team",
    "sn_aia_team_member": "Team Member",
    "sn_aia_tool": "Tool",
    "sn_aia_usecase": "Use case",
    "sn_aia_usecase_config_override": "Usecase Configuration Override",
    "sn_aia_version": "AIA Version",
    "sp_widget": "Widget",
    "sys_agent_access_role_configuration": "Agent Access Role Configuration",
    "sys_app": "Custom Application",
    "sys_db_object": "Table",
    "sys_dictionary": "Dictionary Entry",
    "sys_hub_action_type_definition": "Action Type",
    "sys_hub_flow": "Flow",
    "sys_module": "EcmaScript Module",
    "sys_properties": "System Property",
    "sys_script": "Business Rule",
    "sys_script_client": "Client Script",
    "sys_script_include": "Script Include",
    "sys_security_acl": "Access Control",
    "sys_security_acl_role": "Access Roles",
    "sys_ui_page": "UI Page",
    "sys_user_role": "Role",
    "sys_ux_lib_component": "UX Component Definition",
}

# Candidate columns for the human-readable label shown in the preview list.
NAME_FIELDS = ("name", "title", "label", "sys_name", "short_description", "element")


def derive_sys_id(*parts: str) -> str:
    """Stable 32-char hex id derived from the inputs (not random)."""
    return hashlib.md5("|".join(parts).encode("utf-8"), usedforsecurity=False).hexdigest()


def load_type_map(path):
    """Read a JSON object of {table_name: label}; validate shape."""
    try:
        data = json.loads(Path(path).read_text(encoding="utf-8"))
    except (OSError, ValueError, UnicodeDecodeError) as e:
        sys.exit(f"ERROR: cannot read {path}: {e}")
    if not isinstance(data, dict) or not all(
        isinstance(k, str) and isinstance(v, str) for k, v in data.items()
    ):
        sys.exit(f"ERROR: {path} must be a JSON object of string -> string.")
    return data


def read_inventory(app_dir: Path):
    """Return dist file paths in the SDK's own packaging order.

    package_inventory.csv lists '<relative/path>;<sha256>' after some
    '#key=value' header lines. Falling back to a glob would lose the ordering
    the SDK chose, so the inventory is preferred when present.
    """
    inv = app_dir / "package_inventory.csv"
    meta, files = {}, []
    if inv.exists():
        for row in inv.read_text().splitlines():
            row = row.strip()
            if not row:
                continue
            if row.startswith("#"):
                k, _, v = row[1:].partition("=")
                meta[k] = v
                continue
            rel = row.split(";", 1)[0]
            p = app_dir / rel
            if p.exists():
                files.append(p)
    if not files:
        files = sorted(app_dir.rglob("*.xml"))
    return meta, files


def parse_record(path: Path):
    """Pull the fields a sys_update_xml row needs out of one dist file."""
    raw = path.read_text(encoding="utf-8")
    root = ET.fromstring(raw)
    if root.tag != "record_update":
        return None

    rec = next((c for c in root), None)
    if rec is None:
        return None

    # The SDK does not always set table= on <record_update> (observed on the
    # sys_module record carrying bom.json). The child element IS the table
    # name, so infer from it rather than emitting a blank `table`, which
    # would produce a sys_update_xml row the platform cannot apply.
    table = root.get("table") or rec.tag

    def field(names):
        for n in names:
            el = rec.find(n)
            if el is not None and (el.text or "").strip():
                return el.text.strip()
        return ""

    sys_id = field(("sys_id",))
    # The SDK usually writes sys_update_name; fall back to the platform's
    # own <table>_<sys_id> convention when it doesn't (e.g. some sys_module).
    update_name = field(("sys_update_name",)) or f"{table}_{sys_id}"
    target_name = field(NAME_FIELDS) or update_name

    return {
        "table": table,
        "sys_id": sys_id,
        "update_name": update_name,
        "target_name": target_name,
        # Payload is the original file, declaration included, exactly as the
        # platform stores it. ElementTree escapes it when set as element text.
        "payload": raw.strip(),
        "source_file": path.name,
    }


def sub(parent, tag, text=None, **attrs):
    el = ET.SubElement(parent, tag, {k: v for k, v in attrs.items() if v is not None})
    if text is not None:
        el.text = text
    return el


def build(records, *, set_name, description, scope, scope_sys_id, app_version,
          stamp, type_by_table):
    remote_sys_id = derive_sys_id("remote_update_set", scope, set_name, app_version)
    us_sys_id = derive_sys_id("sys_remote_update_set", scope, set_name, app_version)

    unload = ET.Element("unload", {"unload_date": stamp})

    hdr = ET.SubElement(unload, "sys_remote_update_set", {"action": "INSERT_OR_UPDATE"})
    sub(hdr, "application", scope_sys_id, display_value=scope)
    sub(hdr, "application_name", scope)
    sub(hdr, "application_scope", scope)
    sub(hdr, "application_version", app_version)
    sub(hdr, "collisions")
    sub(hdr, "commit_date")
    sub(hdr, "description", description)
    sub(hdr, "name", set_name)
    sub(hdr, "origin_sys_id")
    sub(hdr, "parent")
    sub(hdr, "release_date")
    sub(hdr, "remote_sys_id", remote_sys_id)
    # 'loaded' is what makes the set previewable after import. Anything else
    # imports as a row you cannot action.
    sub(hdr, "state", "loaded")
    sub(hdr, "summary")
    sub(hdr, "sys_class_name", "sys_remote_update_set")
    sub(hdr, "sys_created_by", "now-sdk")
    sub(hdr, "sys_created_on", stamp)
    sub(hdr, "sys_id", us_sys_id)
    sub(hdr, "sys_mod_count", "0")
    sub(hdr, "sys_updated_by", "now-sdk")
    sub(hdr, "sys_updated_on", stamp)
    sub(hdr, "update_set")
    sub(hdr, "update_source")

    for r in records:
        row = ET.SubElement(unload, "sys_update_xml", {"action": "INSERT_OR_UPDATE"})
        sub(row, "action", "INSERT_OR_UPDATE")
        sub(row, "application", scope_sys_id, display_value=scope)
        sub(row, "category", "customer")
        sub(row, "comments")
        sub(row, "name", r["update_name"])
        sub(row, "payload", r["payload"])
        sub(row, "remote_update_set", us_sys_id, display_value=set_name)
        sub(row, "replace_on_upgrade", "false")
        sub(row, "sys_created_by", "now-sdk")
        sub(row, "sys_created_on", stamp)
        sub(row, "sys_id", derive_sys_id("sys_update_xml", r["update_name"]))
        sub(row, "table", r["table"])
        sub(row, "target_name", r["target_name"])
        sub(row, "type", type_by_table.get(r["table"], r["table"]))
        sub(row, "update_domain", "global")
        # Tied to the record sys_id so the platform recognises repeat updates
        # of the same record rather than treating each import as brand new.
        sub(row, "update_guid", r["sys_id"])
        sub(row, "update_guid_history")

    return unload


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--dist", default="dist/app", help="SDK dist app directory (default: dist/app)")
    ap.add_argument("--out", default=None, help="output XML path (default: target/<scope>-update-set.xml)")
    ap.add_argument("--name", default=None, help="update set name (default: <scope> <version>)")
    ap.add_argument("--description", default=None, help="update set description")
    ap.add_argument("--date", default=None, help="timestamp to stamp (default: now, UTC)")
    ap.add_argument("--type-map", default=None, metavar="JSON",
                    help="JSON file of {table_name: label} to extend/override "
                         "the built-in type labels (see sys_db_object.label)")
    args = ap.parse_args()

    app_dir = Path(args.dist)
    if not app_dir.is_dir():
        sys.exit(f"ERROR: {app_dir} not found — run `now-sdk build` first.")

    type_by_table = dict(TYPE_BY_TABLE)
    if args.type_map:
        type_by_table.update(load_type_map(args.type_map))

    meta, files = read_inventory(app_dir)
    scope = meta.get("build", "unknown_scope")
    app_version = meta.get("appVersion", "0.0.1")
    stamp = args.date or datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
    set_name = args.name or f"{scope} {app_version}"
    description = args.description or (
        f"Generated from {app_dir} by dist_to_update_set.py "
        f"(skill: sdk-dist-to-update-set). "
        f"Scope {scope}, app version {app_version}."
    )

    records, skipped = [], []
    scope_sys_id = ""
    for p in files:
        try:
            rec = parse_record(p)
        except ET.ParseError as e:
            skipped.append((p.name, f"XML parse error: {e}"))
            continue
        except UnicodeDecodeError as e:
            skipped.append((p.name, f"not UTF-8 text: {e}"))
            continue
        if rec is None:
            skipped.append((p.name, "no <record_update> root"))
            continue
        if rec["table"] == "sys_app" and not scope_sys_id:
            scope_sys_id = rec["sys_id"]
        records.append(rec)

    if not records:
        sys.exit("ERROR: no record_update files found — nothing to convert.")

    unload = build(
        records,
        set_name=set_name,
        description=description,
        scope=scope,
        scope_sys_id=scope_sys_id,
        app_version=app_version,
        stamp=stamp,
        type_by_table=type_by_table,
    )

    out = Path(args.out) if args.out else Path("target") / f"{scope}-update-set.xml"
    out.parent.mkdir(parents=True, exist_ok=True)
    ET.indent(unload, space="    ")
    xml = ET.tostring(unload, encoding="unicode")
    out.write_text('<?xml version="1.0" encoding="UTF-8"?>\n' + xml + "\n", encoding="utf-8")

    by_table = {}
    for r in records:
        by_table[r["table"]] = by_table.get(r["table"], 0) + 1

    print(f"update set : {set_name}")
    print(f"scope      : {scope} (sys_app {scope_sys_id or 'NOT FOUND'})")
    print(f"records    : {len(records)} from {len(files)} inventory entries")
    print(f"output     : {out}  ({out.stat().st_size:,} bytes)")
    print("\nrecords by table:")
    for t in sorted(by_table):
        print(f"  {t:38} {by_table[t]:>3}   type={type_by_table.get(t, t)!r}")
    if skipped:
        print("\nSKIPPED:")
        for n, why in skipped:
            print(f"  {n}: {why}")
    if not scope_sys_id:
        print("\nWARNING: no sys_app record in dist — the target instance must already have the app.")


if __name__ == "__main__":
    main()
