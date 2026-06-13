/** DB access module **/

import sqlite from 'sqlite3';

// open the database
const db = new sqlite.Database('theater.db', (err) => {
  if (err) throw err;
});

export default db;