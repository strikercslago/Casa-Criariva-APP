// Isolated PostgreSQL-compatible runtime. Never connects to Supabase.
import { PGlite } from 'npm:@electric-sql/pglite@0.3.14'
function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message) }
const db = new PGlite()
await db.exec(`create role anon; create role authenticated; create role service_role;
  create schema auth; create table auth.users(id uuid primary key);`)
await db.exec(await Deno.readTextFile(new URL('../migrations/20261115220000_google_calendar.sql', import.meta.url)))
const lease = '11111111-1111-4111-8111-111111111111'
const generation = (await db.query<{ generation: string }>('select generation from google_calendar_connection')).rows[0].generation
const acquired = await db.query<{ claimed: boolean }>('select claim_google_calendar_lease($1) as claimed', [lease])
assert(acquired.rows[0].claimed, 'First worker must acquire the lease')
assert(!(await db.query<{ claimed: boolean }>('select claim_google_calendar_lease(gen_random_uuid()) as claimed')).rows[0].claimed, 'Concurrent worker must be rejected')
await db.query('select apply_google_calendar_page($1,$2,$3,$4,$5)', [lease, generation, JSON.stringify([{ id: 'event1', summary: 'Original', etag: 'v1' }]), 'page2', null])
assert((await db.query<{ page_token: string }>('select page_token from google_calendar_connection')).rows[0].page_token === 'page2', 'Cursor must commit with the page')
await db.query('select apply_google_calendar_page($1,$2,$3,$4,$5)', [lease, generation, JSON.stringify([{ id: 'event1', summary: 'Changed', etag: 'v2' }]), null, 'sync2'])
assert((await db.query('select * from google_calendar_events')).rows.length === 1, 'Repeated events must not duplicate')
const synced = (await db.query<{ sync_token: string; page_token: string | null }>('select sync_token,page_token from google_calendar_connection')).rows[0]
assert(synced.sync_token === 'sync2' && synced.page_token === null, 'Final token must advance after all pages')
let rejected = false
try { await db.query('select apply_google_calendar_page(gen_random_uuid(),$1,$2,null,$3)', [generation, '[]', 'bad']) } catch { rejected = true }
assert(rejected, 'Stale worker must be rejected')
assert((await db.query<{ sync_token: string }>('select sync_token from google_calendar_connection')).rows[0].sync_token === 'sync2', 'Rejected write must not change cursor')
await db.exec("update google_calendar_connection set sync_token=null, sync_epoch=gen_random_uuid()")
await db.query('select apply_google_calendar_page($1,$2,$3,null,$4)', [lease, generation, '[]', 'sync3'])
assert((await db.query<{ event: { status: string } }>('select event from google_calendar_events')).rows[0].event.status === 'cancelled', 'Full sync must mark missing mirror entries cancelled')
for (const role of ['anon', 'authenticated']) {
  await db.exec(`set role ${role}`)
  let denied = false
  try { await db.query('select refresh_ciphertext from google_calendar_connection') } catch { denied = true }
  assert(denied, `${role} must not read credentials`)
  denied = false
  try { await db.query('select claim_google_calendar_lease(gen_random_uuid())') } catch { denied = true }
  assert(denied, `${role} must not execute service RPCs`)
  await db.exec('reset role')
}
await db.close()
console.log('SQL checks passed: migration, lease, pagination, idempotency, fencing, full resync and restricted grants.')
