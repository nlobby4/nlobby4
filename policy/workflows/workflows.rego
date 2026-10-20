package main

import rego.v1

deny contains "workflow top-level permissions must be an empty object" if {
  input.permissions != {}
}

deny contains msg if {
  some name, job in input.jobs
  not job.permissions
  msg := sprintf("job must declare explicit permissions: %s", [name])
}

deny contains msg if {
  some _, job in input.jobs
  some _, service in job.services
  image := service.image
  not contains(image, "@sha256:")
  msg := sprintf("external workflow service image must be digest-pinned: %s", [image])
}

deny contains msg if {
  some _, job in input.jobs
  some _, service in job.services
  image := service.image
  not approved_service_image(image)
  msg := sprintf("workflow service image uses an unapproved registry: %s", [image])
}

deny contains msg if {
  some _, job in input.jobs
  some step in job.steps
  reference := step.uses
  not startswith(reference, "./")
  not regex.match(`^[^@]+@[0-9a-f]{40}$`, reference)
  msg := sprintf("external action reference must use an immutable commit SHA: %s", [reference])
}

approved_service_image(image) if startswith(image, "registry:")
approved_service_image(image) if startswith(image, "docker.io/library/registry:")
approved_service_image(image) if startswith(image, "ghcr.io/")
approved_service_image(image) if startswith(image, "mcr.microsoft.com/")
