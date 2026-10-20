# --------------------------------------------------
# Typed JSON table filter.
#
# Validates non-empty object rows against ordered $columns, then emits TSV.
# Columns specify a field and scalar type, with optional nonempty strings.
# Strings cannot contain NUL or line breaks. Tabs and backslashes are escaped.
#
# Input:  [{"name":"example","ready":true}]
# Output: example<TAB>true followed by a newline
# Arguments: --argjson columns '[{"field":"name","type":"string"},{"field":"ready","type":"boolean"}]'
# --------------------------------------------------

def valid_column:
  type == "object"
    and (.field | type == "string" and length > 0)
    and (.type == "string" or .type == "boolean" or .type == "number")
    and ((has("nonempty") | not) or (.nonempty | type) == "boolean");

def valid_cell($column):
  has($column.field)
    and (.[$column.field] | type) == $column.type
    and (if $column.type == "string" then
      .[$column.field]
        | (test("[\u0000\r\n]") | not)
          and (($column.nonempty != true) or length > 0)
    else true end);

if ($columns | type) != "array" or ($columns | length) == 0
  or ($columns | all(.[]; valid_column) | not)
then
  "Columns must define non-empty field names and scalar types" | error
elif type != "array" or length == 0 then
  "Table input must be a non-empty array" | error
elif any(.[]; type != "object" or (. as $row | any($columns[]; . as $column | $row | valid_cell($column) | not))) then
  "Table contains an invalid row" | error
else
  .[] as $row
  | [$columns[] | $row[.field]]
  | @tsv
end
