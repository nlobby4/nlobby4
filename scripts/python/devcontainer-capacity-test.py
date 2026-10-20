#!/usr/bin/env python3
"""Boundary and failure tests without allocating disk space or exhausting inodes."""

import importlib.util
import sys
from pathlib import Path
from types import SimpleNamespace
import unittest
from unittest.mock import patch

# Keep imported repository bytecode in the Python tool cache, not source folders
sys.pycache_prefix = sys.pycache_prefix or str(Path(__file__).resolve().parents[2] / ".cache/python")
spec = importlib.util.spec_from_file_location("capacity", Path(__file__).with_name("devcontainer-capacity.py"))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class CapacityTests(unittest.TestCase):
    def check(self, mib=1024, inodes=1000, files=10000):
        state = SimpleNamespace(f_bavail=mib, f_frsize=1048576, f_files=files, f_favail=inodes)
        return module.capacity("Test", "/unused", 1024, 1000, lambda _: state)

    def test_boundaries(self):
        for mib, inodes, expected in [(1024, 1000, True), (1023, 1000, False),
                                      (1024, 999, False), (2000, 2000, True), (0, 0, False)]:
            with self.subTest(mib=mib, inodes=inodes):
                self.assertEqual(self.check(mib, inodes)["ok"], expected)

    def test_unsupported_inodes(self):
        self.assertTrue(self.check(inodes=0, files=0)["ok"])
        self.assertTrue(self.check(inodes=-1)["ok"])

    def test_inspection_error(self):
        def denied(_):
            raise PermissionError(13, "Permission denied")
        result = module.capacity("Test", "/unused", 1024, 1000, denied)
        self.assertFalse(result["ok"])
        self.assertIn("Permission denied", result["value"])

    def test_windows_byte_capacity_fallback(self):
        with patch.object(module.os, "statvfs", None), patch.object(module.shutil, "disk_usage", return_value=SimpleNamespace(free=2048 * 1048576)):
            result = module.capacity("Test", "/unused", 1024, 1000)
        self.assertTrue(result["ok"])
        self.assertIn("inode accounting unavailable", result["value"])

    def test_invalid_configuration(self):
        for value in ["", "0", "-1", "1.5", " 10", "１２", "2147483648"]:
            with self.subTest(value=value):
                self.assertFalse(module.rows({"DEVCONTAINER_MIN_FREE_MIB": value})[0]["ok"])

    def test_defaults_and_overrides(self):
        self.assertEqual(module.minimum({}, "LIMIT", 1024), 1024)
        self.assertEqual(module.minimum({"LIMIT": "2048"}, "LIMIT", 1024), 2048)


if __name__ == "__main__":
    unittest.main()
