# --------------------------------------------------
# Environment-style assignment value filter.
#
# Reads literal assignments without interpreting quotes or shell syntax.
# Preserves equals signs and empty values, normalizes CRLF endings.
# Missing keys return 1. Invalid names and duplicate keys return 2.
#
# Select the key with -v variable_name=VALUE
# Input:  VALUE=a=b=c
# Output: a=b=c followed by a newline
# --------------------------------------------------

BEGIN {
  if (variable_name !~ /^[A-Za-z_][A-Za-z0-9_]*$/) {
    print "env-value: variable_name must be a valid assignment name" > "/dev/stderr"
    failed = 1
    exit 2
  }
}

{
  sub(/\r$/, "")
  separator = index($0, "=")
  if (!separator) {
    next
  }

  name = substr($0, 1, separator - 1)
  if (name == variable_name) {
    if (found) {
      print "env-value: duplicate assignment for " variable_name > "/dev/stderr"
      failed = 1
      exit 2
    }

    value = substr($0, separator + 1)
    found = 1
  }
}

END {
  if (failed) {
    exit 2
  }

  if (!found) {
    print "env-value: assignment not found for " variable_name > "/dev/stderr"
    exit 1
  }

  print value
}
