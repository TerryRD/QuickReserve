import '@testing-library/jest-dom/vitest'
import { config } from 'dotenv'
import path from 'node:path'

// Load .env.local so integration tests can talk to live Supabase
config({ path: path.resolve(process.cwd(), '.env.local') })
