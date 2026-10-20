#!/usr/bin/env bash
# Source before builds: use one source-commit timestamp, never the wall clock.
# An explicit override is useful when reproducing an older build.

if [[ -z ${SOURCE_DATE_EPOCH+x} ]]; then
  SOURCE_DATE_EPOCH="$(git log -1 --format=%ct)" || return 1
fi
if [[ ! "$SOURCE_DATE_EPOCH" =~ ^(0|[1-9][0-9]{0,10})$ ]]; then
  printf '%s\n' 'SOURCE_DATE_EPOCH must be a non-negative Unix timestamp' >&2
  return 1
fi
export SOURCE_DATE_EPOCH
