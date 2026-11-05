# Updating the API Client and Types

When your Decisions data types change, regenerate the API client and type files using the two-step process below. You will need a valid session token from your Decisions instance.
If you need to create a valid token prompt the user for a username and password and use the 
method to GetJWT below.

## Prerequisites

- Your folder ID and web app ID which come from AI_TOOLS_KNOWN_VALUES.txt
- `curl` and `unzip` available in your terminal

## Getting a JWT Token

Use `AccountService/GetJWT` with `userId` and `password` fields:

```bash
curl -s -X POST "base-url-from-known-values-file/Primary/REST/AccountService/GetJWT" \
  -H "Content-Type: application/json" \
  -d '{"userId": "your@email.com", "password": "yourpassword"}'
```

Response:

```json
{"GetJWTResult":"eyJ..."}
```

Export the token for use in subsequent steps:

```bash
export TOKEN="eyJ..."
```

## Known Values

Known values are stored in a file in this same directory called ai-agent-known-values.txt
and are stored in a property style with name value pairs separated by '=' char and each pair on a new line.

The keys are FolderId, WebAppId, and DecisionsUrl and these values can be used for the templates below. 

## Step 1 — Get available case types

Use `GetCaseTypesForWebApp` with the `WebAppId` value (strip the leading `/`):

```bash
curl -s -X POST "base-url-from-known-values-file/Primary/REST/CustomWebAppService/GetCaseTypesForWebApp" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"webAppId": "web-app-id-from-known-values-file"}'
```

This returns a list of available types, for example:

```json
{"GetCaseTypesForWebAppResult":[{"FullTypeName":"test.ArtRequest","Name":"ArtRequest"}]}
```

Choose the type IDs you want included in the client.

## Step 2 — Generate the updated client

Pass the selected type full names as `selectedTypeFullNames`. Use the `WebAppId` value with the leading `/` stripped:

```bash
curl -s -X POST "base-url-from-known-values-file/Primary/REST/CustomWebAppService/GenerateUpdatedApiClientForWebApp" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "webAppId": "web-app-id-from-known-values-file",
    "selectedTypeFullNames": ["test.ArtRequest"],
    "outputtype": "Json"
  }'
```

The response contains a zip file path:

```json
{"GenerateUpdatedApiClientForWebAppResult":"/apiclient-01KS5JK7SRYEC8795T2D2DA0K3.zip"}
```

## Step 3 — Download and extract

```bash
curl -s -o /tmp/apiclient.zip "base-url-from-known-values-file/apiclient-01KS5JK7SRYEC8795T2D2DA0K3.zip" \
  -H "Authorization: Bearer $TOKEN"

unzip -o /tmp/apiclient.zip -d /tmp/apiclient-out/
```

## Step 4 — Copy files into the project

```bash
cp /tmp/apiclient-out/src/api/apiclient.ts src/api/apiclient.ts
cp /tmp/apiclient-out/src/types/*.ts src/api/types/
```

Commit the updated files and verify the app compiles before deploying.
