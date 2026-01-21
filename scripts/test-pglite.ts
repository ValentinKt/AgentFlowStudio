import { PGlite } from '@electric-sql/pglite';

async function test() {
  try {
    const db = new PGlite();
    await db.exec('SELECT 1');
    console.log('PGlite works!');
  } catch (e) {
    console.error('PGlite failed:', e);
  }
}

test();
