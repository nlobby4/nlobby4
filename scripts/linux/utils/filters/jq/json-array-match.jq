# --------------------------------------------------
# JSON array-record matching filter.
#
# Selects exactly one object whose $match_path equals $match_value.
# Missing paths do not match null. Invalid or ambiguous input fails.
#
# Input:  [{"active":true,"name":"example"}]
# Output: {"active":true,"name":"example"}
# Arguments: --argjson match_path '["active"]' --argjson match_value true
# --------------------------------------------------

if ($match_path | type) != "array"
  or ($match_path | all(.[]; type == "string" or (type == "number" and . >= 0 and floor == .)) | not)
then
  "Match path must be an array of strings and non-negative integers" | error
elif type != "array" or any(.[]; type != "object") then
  "Input must be an array of objects" | error
else
  [
    .[]
    | select($match_path == [] or any(paths; . == $match_path))
    | select(getpath($match_path) == $match_value)
  ]
  | if length != 1 then
      "Match must select exactly one array record" | error
    else
      .[0]
    end
end
