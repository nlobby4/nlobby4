#!/usr/bin/env python3

# --------------------------------------------------
# Isolated regressions for owner-scoped license collection
#
# Usage:
# python3 scripts/python/collect-licenses-test.py
# --------------------------------------------------

import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import subprocess


spec = importlib.util.spec_from_file_location("collector", Path(__file__).with_name("collect-licenses.py"))
collector = importlib.util.module_from_spec(spec)
spec.loader.exec_module(collector)


class LicenseTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.owner = self.root / "projects/package"
        self.owner.mkdir(parents=True)
        self.write("pnpm-lock.yaml", "fixture lock\n")
        self.write("projects/package/package.json", '{"name":"@example/project"}')
        self.write("scripts/python/collect-licenses.py", "fixture collector\n")

    def write(self, file, data):
        target = self.root / file
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(data)
        return target

    def dependency(self):
        self.write("projects/package/package.json", '{"name":"@example/project","dependencies":{"@example/dependency":"1.0.0"}}')
        self.write("installed/pkg/package.json", '{"name":"@example/dependency","version":"1.0.0"}')
        self.write("installed/pkg/LICENSE", "unaltered notice\n")
        self.write("installed/pkg/NOTICE.txt", "attribution\n")
        self.write("installed/pkg/node_modules/other/LICENSE", "excluded nested dependency\n")
        link = self.owner / "node_modules/@example/dependency"
        link.parent.mkdir(parents=True, exist_ok=True)
        if not link.exists():
            link.symlink_to(self.root / "installed/pkg", target_is_directory=True)
        return {"MIT": [{"name": "@example/dependency", "versions": ["1.0.0"], "paths": [str(self.root / "installed/pkg")]}]}

    def inventory(self):
        outputs, inventory = collector.collect(self.root, self.owner, run=lambda args, **kwargs: self.dependency())
        for file, data in outputs.items():
            target = self.owner / "licenses" / file
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(data)
        (self.owner / "licenses/inventory.json").write_bytes(collector.json_bytes(inventory))
        return outputs, inventory

    def test_native_inventory_and_owner_selection(self):
        calls = []
        def run(args, **kwargs):
            calls.append(args)
            return self.dependency()
        outputs, inventory = collector.collect(self.root, self.owner, run=run)
        self.assertEqual(calls, [["pnpm", "--filter", "@example/project", "licenses", "list", "--json"]])
        self.assertEqual(len(outputs), 2)
        self.assertEqual(inventory["owner"], "projects/package")
        self.assertNotIn(str(self.root), json.dumps(inventory))
        self.assertIn(b"unaltered notice\n", outputs.values())

    def test_empty_dependency_project(self):
        outputs, inventory = collector.collect(self.root, self.owner, run=lambda *args, **kwargs: {})
        self.assertEqual(outputs, {})
        self.assertEqual(inventory["packages"], {})

    def test_transitive_dependencies_and_other_versions_are_excluded(self):
        report = self.dependency()
        report["MIT"].extend([
            {"name": "transitive", "versions": ["2.0.0"], "paths": ["/unused"]},
            {"name": "@example/dependency", "versions": ["9.0.0"], "paths": ["/unused"]},
        ])
        _, inventory = collector.collect(self.root, self.owner, run=lambda *args, **kwargs: report)
        self.assertEqual(list(inventory["packages"]), ["npm:@example/dependency@1.0.0"])

    def test_missing_direct_dependency_fails(self):
        self.write("projects/package/package.json", '{"name":"@example/project","dependencies":{"missing":"1.0.0"}}')
        with self.assertRaisesRegex(ValueError, "not installed"):
            collector.collect(self.root, self.owner, run=lambda *args, **kwargs: {})

    def test_native_pnpm_empty_sentinel(self):
        with patch.object(collector.subprocess, "run", return_value=subprocess.CompletedProcess([], 0, b"No licenses in packages found\n", b"")):
            self.assertEqual(collector.command(["pnpm", "licenses", "list", "--json"]), {})
            with self.assertRaisesRegex(ValueError, "invalid inventory JSON"):
                collector.command(["mise", "ls", "--json"])

    def test_metadata_mismatch(self):
        report = self.dependency()
        report["MIT"][0]["name"] = "different"
        with self.assertRaisesRegex(ValueError, "disagrees"):
            collector.npm_notices(report, {}, {})

    def test_missing_notice_is_explicit_gap(self):
        report = self.dependency()
        (self.root / "installed/pkg/LICENSE").unlink()
        (self.root / "installed/pkg/NOTICE.txt").unlink()
        _, inventory = collector.collect(self.root, self.owner, run=lambda *args, **kwargs: report)
        self.assertEqual(len(inventory["gaps"]), 1)

    def test_duplicate_records_are_stable(self):
        outputs, records = {}, {}
        report = self.dependency()
        collector.npm_notices(report, outputs, records)
        collector.npm_notices(report, outputs, records)
        self.assertEqual(len(records), 1)
        self.assertEqual(len(next(iter(records.values()))["notices"]), 2)

    def test_conflicting_notices_fail(self):
        outputs, records = {}, {}
        report = self.dependency()
        collector.npm_notices(report, outputs, records)
        self.write("installed/pkg/LICENSE", "changed bytes\n")
        with self.assertRaisesRegex(ValueError, "Conflicting"):
            collector.npm_notices(report, outputs, records)

    def test_offline_check_and_input_drift(self):
        _, inventory = self.inventory()
        self.assertEqual(collector.check(self.root, self.owner), inventory)
        self.write("pnpm-lock.yaml", "changed\n")
        with self.assertRaisesRegex(ValueError, "inputs drifted"):
            collector.check(self.root, self.owner)

    def test_notice_drift(self):
        outputs, _ = self.inventory()
        (self.owner / "licenses" / next(iter(outputs))).write_text("changed")
        with self.assertRaisesRegex(ValueError, "notice drift"):
            collector.check(self.root, self.owner)

    def test_inventory_cannot_escape_owner(self):
        _, inventory = self.inventory()
        inventory["files"] = {"../../outside": "any"}
        (self.owner / "licenses/inventory.json").write_bytes(collector.json_bytes(inventory))
        with self.assertRaisesRegex(ValueError, "notice drift"):
            collector.check(self.root, self.owner)

    def test_unsafe_notice_inputs(self):
        target = self.write("empty", "")
        with self.assertRaises(ValueError):
            collector.notice_bytes(target)
        target.write_bytes(b"binary\0notice")
        with self.assertRaises(ValueError):
            collector.notice_bytes(target)
        link = self.root / "link"
        link.symlink_to(target)
        with self.assertRaises(ValueError):
            collector.notice_bytes(link)

    def test_tool_versions_and_source_coverage(self):
        self.write("mise.toml", '[tools]\nnode = "24.15.0"\n')
        self.write(".devcontainer/versions.env", "MISE_VERSION=2026.9.18\n")
        self.assertEqual(collector.tool_pins(self.root), {"node": "24.15.0", "mise": "2026.9.18"})
        self.write("licenses/sources.json", '{"tools":{}}')
        with self.assertRaisesRegex(ValueError, "exactly"):
            collector.primary_notices(self.root, {}, {})
        self.write("mise.toml", '[tools]\nnode = "latest"\n')
        with self.assertRaisesRegex(ValueError, "exact"):
            collector.tool_pins(self.root)

    def test_pinned_notice_acquisition(self):
        self.write("mise.toml", '[tools]\nnode = "24.15.0"\n')
        self.write(".devcontainer/versions.env", "MISE_VERSION=2026.9.18\n")
        self.write("licenses/sources.json", json.dumps({"tools": {name: {"repository": "example/" + name, "tag": "v{version}"} for name in ("node", "mise")}}))
        outputs, records = {}, {}
        collector.primary_notices(self.root, outputs, records, fetch=lambda url: b"license\n" if url.endswith("/LICENSE") else None)
        self.assertEqual(len(outputs), 2)
        self.assertEqual(len(records), 2)
        with self.assertRaisesRegex(ValueError, "No upstream notice"):
            collector.primary_notices(self.root, {}, {}, fetch=lambda url: None)


if __name__ == "__main__":
    unittest.main()
