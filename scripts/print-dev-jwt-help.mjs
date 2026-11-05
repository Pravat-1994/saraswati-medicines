// Runs before the Vite dev server starts (see the "localdev" script in package.json).
// Prints a reminder of how to fetch a developer JWT and where to put it, so a
// stale/missing VITE_DEC_FORCE_SESSION_ID doesn't leave someone stuck silently.
import { loadEnv } from 'vite'

const env = loadEnv('localdevelopment', process.cwd(), '')
const decisionsBase = env.VITE_DEC_PORTAL_FOR_PROXY

const lines = ['']
lines.push('Need a developer JWT for VITE_DEC_FORCE_SESSION_ID?')
lines.push('')

if (decisionsBase) {
  const url = `${decisionsBase}/Primary/REST/AccountService/GetJWT`
  lines.push(`  POST your Decisions credentials to: ${url}`)
  lines.push('')
  lines.push(`  curl -s -X POST "${url}" \\`)
  lines.push('    -H "Content-Type: application/json" \\')
  lines.push(`    -d '{"userId": "you@email.com", "password": "yourpassword"}'`)
} else {
  lines.push('  VITE_DEC_PORTAL_FOR_PROXY is not set in .env.localdevelopment.')
  lines.push('  Set it, then re-run this command to see the exact URL and curl command.')
}

lines.push('')
lines.push('  Copy the "GetJWTResult" value from the response into VITE_DEC_FORCE_SESSION_ID')
lines.push('  in .env.localdevelopment')
lines.push('')

console.log(lines.join('\n'))