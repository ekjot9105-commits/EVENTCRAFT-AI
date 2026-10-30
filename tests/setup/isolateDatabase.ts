import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Give every Vitest worker its own SQLite file so parallel integration suites
// never contend for the same write lock ("database is locked" under coverage).
const workerId = process.env['VITEST_POOL_ID'] ?? process.env['VITEST_WORKER_ID'] ?? '0';
process.env['DATABASE_PROVIDER'] = 'sqlite';
process.env['SQLITE_PATH'] = join(tmpdir(), `eventcraft-test-${process.pid}-${workerId}.sqlite`);
