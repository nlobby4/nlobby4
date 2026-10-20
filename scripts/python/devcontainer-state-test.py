"""Exercise image fingerprint boundaries in an isolated copy, without Docker."""

import importlib.util
import json
import shutil
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
# Keep imported repository bytecode in the Python tool cache, not source folders
sys.pycache_prefix = sys.pycache_prefix or str(ROOT / ".cache/python")
SPEC = importlib.util.spec_from_file_location(
    "devcontainer_state", Path(__file__).with_name("devcontainer-state.py")
)
STATE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(STATE)
SYNC_SPEC = importlib.util.spec_from_file_location(
    "sync_toolchain", Path(__file__).with_name("sync-toolchain.py")
)
SYNC = importlib.util.module_from_spec(SYNC_SPEC)
SYNC_SPEC.loader.exec_module(SYNC)


class ImageInputs(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory(prefix="image-inputs-")
        self.addCleanup(self.directory.cleanup)
        self.root = Path(self.directory.name)
        shutil.copytree(ROOT / ".mise/locks", self.root / ".mise/locks")
        for name in (*STATE.FILES, ".devcontainer/devcontainer.json", "mise.toml", "mise.lock", "package.json"):
            target = self.root / name
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(ROOT / name, target)
        self.before = STATE.inputs(self.root)

    def test_stable(self):
        self.assertEqual(self.before, STATE.inputs(self.root))

    def test_frozen_tool_locks(self):
        STATE.tool_locks(self.root)

    def test_package_manager_alignment(self):
        target = self.root / "package.json"
        target.write_text(target.read_text().replace('pnpm@10.20.0', 'pnpm@99.0.0'))
        with self.assertRaisesRegex(ValueError, "packageManager"):
            STATE.tool_locks(self.root)

    def test_toolchain_synchronization_is_idempotent(self):
        self.assertFalse(SYNC.synchronize(self.root))

    def test_toolchain_synchronization_follows_mise(self):
        target = self.root / "mise.toml"
        target.write_text(target.read_text().replace('node = "24.15.0"', 'node = "26.1.0"')
                          .replace('"npm:pnpm" = "10.20.0"', '"npm:pnpm" = "12.8.1"'))
        self.assertTrue(SYNC.synchronize(self.root))
        manifest = json.loads((self.root / "package.json").read_text())
        self.assertEqual(manifest["packageManager"], "pnpm@12.8.1")
        self.assertEqual(manifest["engines"], {"node": ">=26.1.0 <27", "pnpm": ">=12"})
        self.assertFalse(SYNC.synchronize(self.root))

    def test_tool_pin_drift(self):
        target = self.root / "mise.toml"
        target.write_text(target.read_text().replace('node = "24.15.0"', 'node = "24.15.1"'))
        with self.assertRaisesRegex(ValueError, "pin/lock mismatch"):
            STATE.tool_locks(self.root)

    def test_unchanged_version_missing_artifact(self):
        target = self.root / "mise.lock"
        target.write_text(target.read_text().replace('[tools.node."platforms.linux-arm64"]', '[tools.node."platforms.missing"]'))
        with self.assertRaisesRegex(ValueError, "missing frozen artifact"):
            STATE.tool_locks(self.root)

    def test_unchanged_version_missing_checksum(self):
        target = self.root / "mise.lock"
        target.write_text(target.read_text().replace('checksum = "sha256:', 'missing_checksum = "sha256:', 1))
        with self.assertRaisesRegex(ValueError, "missing frozen artifact"):
            STATE.tool_locks(self.root)

    def test_missing_python_graph_reference_fails(self):
        import re
        target = self.root / "mise.lock"
        target.write_text(re.sub(r"^uv = .*\n", "", target.read_text(), count=1, flags=re.M))
        with self.assertRaisesRegex(ValueError, "missing native graph"):
            STATE.inputs(self.root)

    def test_native_graph_tampering_fails(self):
        target = next((self.root / ".mise/locks").rglob("uv.lock"))
        target.write_bytes(target.read_bytes() + b"\n# tampered\n")
        with self.assertRaisesRegex(ValueError, "digest mismatch"):
            STATE.inputs(self.root)

    def test_missing_native_graph_fails(self):
        next((self.root / ".mise/locks").rglob("aube-lock.yaml")).unlink()
        with self.assertRaises(FileNotFoundError):
            STATE.inputs(self.root)

    def test_native_graph_crlf_is_equivalent(self):
        for target in (self.root / ".mise/locks").rglob("*"):
            if target.is_file():
                target.write_bytes(target.read_bytes().replace(b"\n", b"\r\n"))
        self.assertEqual(self.before, STATE.inputs(self.root))

    def test_native_manifest_requires_rebuild(self):
        target = next((self.root / ".mise/locks").rglob("package.json"))
        target.write_bytes(target.read_bytes() + b"\n")
        self.assertNotEqual(self.before, STATE.inputs(self.root))

    def test_native_graph_cannot_escape(self):
        target = self.root / "mise.lock"
        target.write_text(target.read_text().replace('path = ".mise/locks/', 'path = "../', 1))
        with self.assertRaisesRegex(ValueError, "invalid native graph path"):
            STATE.inputs(self.root)

    def test_missing_graph_reference_fails(self):
        import re
        target = self.root / "mise.lock"
        target.write_text(re.sub(r"^aube = .*\n", "", target.read_text(), count=1, flags=re.M))
        with self.assertRaisesRegex(ValueError, "missing native graph"):
            STATE.inputs(self.root)

    def test_tasks_not_required_validation(self):
        target = self.root / "mise.toml"
        target.write_text(target.read_text() + '\n[tasks.audit-only]\nrun = "true"\n')
        self.assertEqual(self.before, STATE.inputs(self.root))

    def test_each_raw_input_requires_rebuild(self):
        for name in STATE.FILES:
            with self.subTest(name=name):
                target = self.root / name
                original = target.read_bytes()
                target.write_bytes(original + b"\n")
                self.assertNotEqual(self.before, STATE.inputs(self.root))
                target.write_bytes(original)

    def test_tool_configuration_requires_rebuild(self):
        target = self.root / "mise.toml"
        target.write_text(target.read_text().replace('node = "24.15.0"', 'node = "0.0.0"'))
        self.assertNotEqual(self.before, STATE.inputs(self.root))

    def test_lock_artifact_requires_rebuild(self):
        target = self.root / "mise.lock"
        import re
        target.write_text(re.sub(r'sha256:[a-f0-9]{64}', 'sha256:' + '0' * 64, target.read_text(), count=1))
        self.assertNotEqual(self.before, STATE.inputs(self.root))

    def test_editor_settings_do_not_require_rebuild(self):
        target = self.root / ".devcontainer/devcontainer.json"
        config = json.loads(target.read_text())
        config["customizations"] = {}
        target.write_text(json.dumps(config))
        self.assertEqual(self.before, STATE.inputs(self.root))


if __name__ == "__main__":
    unittest.main()
