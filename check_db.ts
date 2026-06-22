import db from './src/db';
console.log(db.prepare('PRAGMA table_info(items)').all());
