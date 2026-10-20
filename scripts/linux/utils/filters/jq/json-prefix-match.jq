# --------------------------------------------------
# JSON object-entry prefix matching filter.
#
# Finds exactly one entry under $object_path whose
# key starts with $key_prefix, then returns each field
# named in $fields as a separate result.
#
# Input:  {"tools":{"tool:1":{"version":"1.0"}}}
# Output: "1.0"
# Arguments: --argjson object_path '["tools"]' --arg key_prefix 'tool:' --argjson fields '["version"]'
# --------------------------------------------------

# Check whether a value is a supported structured JSON path
def valid_json_path:
  type == "array"
    and all(
      .[];
      type == "string"
        or (type == "number" and . >= 0 and floor == .)
    );

# Validate arguments and select the requested entry fields
if ($object_path | valid_json_path | not) then
  "Object path must be an array of strings and non-negative integers"
    | error
elif ($key_prefix | type) != "string" or $key_prefix == "" then
  "Key prefix must be a non-empty string"
    | error
elif ($fields | type) != "array"
  or ($fields | length) == 0
  or ($fields | all(.[]; type == "string" and length > 0) | not)
then
  "Fields must be a non-empty array of non-empty strings"
    | error
else
  getpath($object_path) as $object
  | if ($object | type) != "object" then
      "Object path does not resolve to an object"
        | error
    else
      [
        $object
        | to_entries[]
        | select(.key | startswith($key_prefix))
      ] as $matches
      | if ($matches | length) != 1 then
          "Key prefix must match exactly one object entry"
            | error
        else
          $matches[0].value as $entry
          | $fields[] as $field
          | if ($entry | type) != "object" or ($entry | has($field) | not) then
              "Selected entry does not contain field: \($field)"
                | error
            else
              $entry[$field]
            end
        end
    end
end
