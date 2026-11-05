#!/usr/bin/env zsh

#Script is used to test the MCP tools without actually having to use any AI
#it downloads the updated api client and unpacks it into this folder.

# Load configuration from updatetest.properties (must live next to this script).
# Edit that file to update the JWT token, server URL, or web app ID without
# touching this script.
PROPERTIES_FILE="$(dirname "$0")/updatetest.properties"
if [[ ! -f "${PROPERTIES_FILE}" ]]; then
  echo "Error: properties file not found: ${PROPERTIES_FILE}"
  exit 1
fi

# Load properties (skip blank lines and comments)
while IFS='=' read -r key value; do
  [[ -z "${key}" || "${key}" == \#* ]] && continue
  export "${key}"="${value}"
done < "${PROPERTIES_FILE}"

for var in TOKEN BASE_URL WEB_APP_ID; do
  if [[ -z "${(P)var}" ]]; then
    echo "Error: '${var}' is not set in ${PROPERTIES_FILE}"
    exit 1
  fi
done

OUT_DIR="./tmp/apiclient-out"

# Reset tmp directory
if [[ -d "./tmp" ]]; then
  rm -rf "./tmp"
fi
mkdir "./tmp"

# Step 1: Fetch available types
echo "Fetching available case types..."
TYPES_RESPONSE=$(curl -s -X POST "${BASE_URL}/Primary/REST/CustomWebAppService/GetCaseTypesForWebApp" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{\"webAppId\": \"${WEB_APP_ID}\"}")

if [[ -z "${TYPES_RESPONSE}" ]]; then
  echo "Error: no response from GetCaseTypesForWebApp"
  exit 1
fi

echo "Testing response for data types."
echo ${TYPES_RESPONSE}
echo "END Testing response for data types."

# Parse type names from response — handles both a plain JSON array of strings
# and an object with a result key containing the array.
if command -v jq &>/dev/null; then
  # Try result key first, fall back to root array
  RAW_TYPES=$(echo "${TYPES_RESPONSE}" | jq -r '
    if type == "object" then
      (to_entries | map(select(.key | test("Result$";"i"))) | .[0].value // .) |
      if type == "array" then .[] | if type == "string" then . else (.FullTypeName // .) end
      else empty end
    elif type == "array" then
      .[] | if type == "string" then . else (.FullTypeName // .) end
    else empty end
  ' 2>/dev/null)
else
  # Fallback: extract quoted strings that look like dotted type names (e.g. hhh.LegalCase)
  RAW_TYPES=$(echo "${TYPES_RESPONSE}" | grep -oE '"[A-Za-z][A-Za-z0-9]*\.[A-Za-z][A-Za-z0-9]+"' | tr -d '"' | sort -u)
fi

if [[ -z "${RAW_TYPES}" ]]; then
  echo "Error: could not parse type names from response."
  echo "Raw response: ${TYPES_RESPONSE}"
  exit 1
fi

# Build an indexed array of types
typeset -a AVAILABLE_TYPES
while IFS= read -r line; do
  [[ -n "${line}" ]] && AVAILABLE_TYPES+=("${line}")
done <<< "${RAW_TYPES}"

# Step 2: Present types to user
echo ""
echo "Available case types:"
for i in {1..${#AVAILABLE_TYPES[@]}}; do
  printf "  %2d) %s\n" "${i}" "${AVAILABLE_TYPES[$i]}"
done
echo ""
echo "Enter numbers separated by spaces (e.g. 1 3 5), or 'all' to include every type:"
printf "> "
read -r USER_INPUT

# Step 3: Build selected types array
typeset -a SELECTED_TYPES
if [[ "${USER_INPUT:l}" == "all" ]]; then
  SELECTED_TYPES=("${AVAILABLE_TYPES[@]}")
else
  for num in ${=USER_INPUT}; do
    if [[ "${num}" =~ '^[0-9]+$' ]] && (( num >= 1 && num <= ${#AVAILABLE_TYPES[@]} )); then
      SELECTED_TYPES+=("${AVAILABLE_TYPES[$num]}")
    else
      echo "Warning: ignoring invalid selection '${num}'"
    fi
  done
fi

if [[ ${#SELECTED_TYPES[@]} -eq 0 ]]; then
  echo "Error: no valid types selected."
  exit 1
fi

echo ""
echo "Selected types:"
for t in "${SELECTED_TYPES[@]}"; do
  echo "  - ${t}"
done
echo ""

# Step 4: Build JSON array and call GenerateUpdatedApiClientForWebApp
TYPES_JSON=$(printf '"%s",' "${SELECTED_TYPES[@]}")
TYPES_JSON="[${TYPES_JSON%,}]"

echo "Generating updated API client..."
RESPONSE=$(curl -s -X POST "${BASE_URL}/Primary/REST/CustomWebAppService/GenerateUpdatedApiClientForWebApp" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{\"webAppId\": \"${WEB_APP_ID}\", \"selectedTypeFullNames\": ${TYPES_JSON}, \"outputtype\": \"Json\"}")

echo "Response: ${RESPONSE}"

ZIP_PATH=$(echo "${RESPONSE}" | grep -o '"GenerateUpdatedApiClientForWebAppResult":"[^"]*"' | cut -d'"' -f4)

if [[ -z "${ZIP_PATH}" ]]; then
  echo "Error: could not parse zip path from response"
  exit 1
fi

echo "Downloading ${ZIP_PATH}..."
curl -s -o ./tmp/apiclient.zip "${BASE_URL}${ZIP_PATH}" \
  -H "Authorization: Bearer ${TOKEN}"

echo "Extracting..."
rm -rf "${OUT_DIR}"
unzip -o ./tmp/apiclient.zip -d "${OUT_DIR}"

echo "Done. Opening ${OUT_DIR} in Finder..."
open "${OUT_DIR}"
