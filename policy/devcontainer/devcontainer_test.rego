package main

import rego.v1

test_missing_configuration_denied if {
  results := deny with input as {}
  count(results) > 0
}

test_empty_configuration_denied if {
  results := deny with input as {"devcontainer": {}, "lock": {"features": {}}}
  count(results) > 0
}

test_wrong_types_denied if {
  every value in [null, [], "invalid", 1] {
    results := deny with input as {"devcontainer": value, "lock": {"features": value}}
    count(results) > 0
  }
}

test_incomplete_lock_entry_denied if {
  results := deny with input as {
    "devcontainer": {"remoteUser": "developer", "init": true, "mounts": [], "features": {"ghcr.io/devcontainers/features/docker-in-docker:4.1.1": {}}},
    "lock": {"features": {"ghcr.io/devcontainers/features/docker-in-docker:4.1.1": {}}},
  }
  count(results) > 0
}

# Shared graph fixture: an exact root and a partial-version transitive dependency.
root_feature := "ghcr.io/devcontainers/features/docker-in-docker:4.1.1"
dependency_feature := "ghcr.io/devcontainers/features/common-utils:2"
fixture_digest := "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
fixture_configuration := {"remoteUser": "developer", "init": true, "mounts": [], "features": {root_feature: {}}}
fixture_root := {"version": "4.1.1", "resolved": sprintf("ghcr.io/devcontainers/features/docker-in-docker@%s", [fixture_digest]), "integrity": fixture_digest, "dependsOn": [dependency_feature]}
fixture_dependency := {"version": "2.5.1", "resolved": sprintf("ghcr.io/devcontainers/features/common-utils@%s", [fixture_digest]), "integrity": fixture_digest}

test_transitive_feature_allowed if {
  results := deny with input as {"devcontainer": fixture_configuration, "lock": {"features": {root_feature: fixture_root, dependency_feature: fixture_dependency}}}
  count(results) == 0
}

test_missing_dependency_denied if {
  results := deny with input as {"devcontainer": fixture_configuration, "lock": {"features": {root_feature: fixture_root}}}
  count(results) > 0
}

test_stale_dependency_denied if {
  root := object.remove(fixture_root, ["dependsOn"])
  results := deny with input as {"devcontainer": fixture_configuration, "lock": {"features": {root_feature: root, dependency_feature: fixture_dependency}}}
  count(results) > 0
}

test_invalid_dependency_values_denied if {
  every dependencies in [null, "invalid", [null], [1], [{}]] {
    root := object.union(fixture_root, {"dependsOn": dependencies})
    results := deny with input as {"devcontainer": fixture_configuration, "lock": {"features": {root_feature: root, dependency_feature: fixture_dependency}}}
    count(results) > 0
  }
}

test_invalid_dependency_entry_denied if {
  every change in [{"version": "3.0.0"}, {"version": "2"}, {"integrity": "sha256:abc"}, {"resolved": "invalid"}] {
    dependency := object.union(fixture_dependency, change)
    results := deny with input as {"devcontainer": fixture_configuration, "lock": {"features": {root_feature: fixture_root, dependency_feature: dependency}}}
    count(results) > 0
  }
}

test_reachable_cycle_terminates if {
  dependency := object.union(fixture_dependency, {"dependsOn": [root_feature]})
  results := deny with input as {"devcontainer": fixture_configuration, "lock": {"features": {root_feature: fixture_root, dependency_feature: dependency}}}
  count(results) == 0
}

test_digest_dependency_allowed if {
  feature := sprintf("ghcr.io/devcontainers/features/common-utils@%s", [fixture_digest])
  root := object.union(fixture_root, {"dependsOn": [feature]})
  results := deny with input as {"devcontainer": fixture_configuration, "lock": {"features": {root_feature: root, feature: fixture_dependency}}}
  count(results) == 0
}

test_unversioned_dependency_allowed if {
  feature := "ghcr.io/devcontainers/features/common-utils"
  root := object.union(fixture_root, {"dependsOn": [feature]})
  results := deny with input as {"devcontainer": fixture_configuration, "lock": {"features": {root_feature: root, feature: fixture_dependency}}}
  count(results) == 0
}

test_unapproved_dependency_denied if {
  feature := "ghcr.io/untrusted/features/common-utils:2"
  root := object.union(fixture_root, {"dependsOn": [feature]})
  dependency := object.union(fixture_dependency, {"resolved": sprintf("ghcr.io/untrusted/features/common-utils@%s", [fixture_digest])})
  results := deny with input as {"devcontainer": fixture_configuration, "lock": {"features": {root_feature: root, feature: dependency}}}
  count(results) > 0
}

test_nested_dependency_allowed if {
  leaf := "ghcr.io/devcontainers/features/git:1.2"
  dependency := object.union(fixture_dependency, {"dependsOn": [leaf]})
  entry := {"version": "1.2.3", "resolved": sprintf("ghcr.io/devcontainers/features/git@%s", [fixture_digest]), "integrity": fixture_digest}
  results := deny with input as {"devcontainer": fixture_configuration, "lock": {"features": {root_feature: fixture_root, dependency_feature: dependency, leaf: entry}}}
  count(results) == 0
}

test_disconnected_cycle_denied if {
  root := object.remove(fixture_root, ["dependsOn"])
  dependency := object.union(fixture_dependency, {"dependsOn": [dependency_feature]})
  results := deny with input as {"devcontainer": fixture_configuration, "lock": {"features": {root_feature: root, dependency_feature: dependency}}}
  count(results) > 0
}

test_digest_selector_mismatch_denied if {
  feature := "ghcr.io/devcontainers/features/common-utils@sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
  root := object.union(fixture_root, {"dependsOn": [feature]})
  results := deny with input as {"devcontainer": fixture_configuration, "lock": {"features": {root_feature: root, feature: fixture_dependency}}}
  count(results) > 0
}

test_exact_root_version_mismatch_denied if {
  root := object.union(fixture_root, {"version": "4.1.2"})
  results := deny with input as {"devcontainer": fixture_configuration, "lock": {"features": {root_feature: root, dependency_feature: fixture_dependency}}}
  count(results) > 0
}
