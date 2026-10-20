package main

import rego.v1

deny contains "devcontainer must contain a non-root remoteUser, init, mounts and features" if {
  not valid_configuration
}

valid_configuration if {
  is_object(input.devcontainer)
  is_string(input.devcontainer.remoteUser)
  input.devcontainer.remoteUser != ""
  input.devcontainer.remoteUser != "root"
  input.devcontainer.init == true
  is_array(input.devcontainer.mounts)
  is_object(input.devcontainer.features)
  count(input.devcontainer.features) > 0
}

deny contains "Feature lock must be a non-empty object" if {
  not valid_lock
}

valid_lock if {
  is_object(input.lock.features)
  count(input.lock.features) > 0
}

deny contains msg if {
  some feature, locked in input.lock.features
  not valid_locked_entry(feature, locked)
  msg := sprintf("invalid or stale Feature lock entry: %s", [feature])
}

valid_locked_entry(feature, locked) if {
  roots := {key | some key, _ in input.devcontainer.features}
  feature in graph.reachable(feature_dependencies, roots)
  regex.match(`^ghcr\.io/devcontainers/features/[a-z0-9-]+(:[0-9]+(\.[0-9]+){0,2}|@sha256:[a-f0-9]{64})?$`, feature)
  is_object(locked)
  regex.match(`^[0-9]+\.[0-9]+\.[0-9]+$`, locked.version)
  valid_feature_selector(feature, locked)
  valid_dependencies(locked)
  regex.match(`^sha256:[a-f0-9]{64}$`, locked.integrity)
  repository := regex.replace(feature, `(:[0-9]+(\.[0-9]+){0,2}|@sha256:[a-f0-9]{64})$`, "")
  locked.resolved == sprintf("%s@%s", [repository, locked.integrity])
}

feature_dependencies := {feature: dependencies |
  some feature, locked in input.lock.features
  dependencies := object.get(locked, "dependsOn", [])
  is_array(dependencies)
  every dependency in dependencies { is_string(dependency) }
}

valid_dependencies(locked) if {
  dependencies := object.get(locked, "dependsOn", [])
  is_array(dependencies)
  every dependency in dependencies {
    is_string(dependency)
    object.get(input.lock.features, dependency, null) != null
  }
}

valid_feature_selector(feature, locked) if {
  not contains(feature, ":")
  not contains(feature, "@")
}

valid_feature_selector(feature, locked) if {
  not contains(feature, "@")
  selector := split(feature, ":")[1]
  locked.version == selector
}

valid_feature_selector(feature, locked) if {
  not contains(feature, "@")
  selector := split(feature, ":")[1]
  startswith(locked.version, sprintf("%s.", [selector]))
}

valid_feature_selector(feature, locked) if {
  endswith(feature, sprintf("@%s", [locked.integrity]))
}

deny contains msg if {
  input.devcontainer.remoteUser == "root"
  msg := "remoteUser must be non-root"
}

deny contains msg if {
  input.devcontainer.init != true
  msg := "init must be enabled"
}

deny contains msg if {
  some mount in input.devcontainer.mounts
  mount_contains_docker_socket(mount)
  msg := "host Docker socket mounts are forbidden"
}

mount_contains_docker_socket(mount) if {
  is_string(mount)
  contains(lower(mount), "docker.sock")
}

mount_contains_docker_socket(mount) if {
  is_object(mount)
  some _, value in mount
  is_string(value)
  contains(lower(value), "docker.sock")
}

deny contains msg if {
  some feature, _ in input.devcontainer.features
  not regex.match(`^ghcr\.io/devcontainers/features/[a-z0-9-]+:[0-9]+\.[0-9]+\.[0-9]+$`, feature)
  msg := sprintf("feature must use an approved registry and exact version: %s", [feature])
}

deny contains msg if {
  some feature, _ in input.devcontainer.features
  not input.lock.features[feature]
  msg := sprintf("feature is absent from devcontainer-lock.json: %s", [feature])
}
