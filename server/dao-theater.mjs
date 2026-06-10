import db from './db.mjs';
/* DAO per la gestione delle prenotazioni del teatro. Fornisce funzioni per ottenere la mappa dei posti, 
gestire le prenotazioni degli utenti, assegnare posti in base alla categoria, 
e tenere traccia dei posti rilasciati per applicare il cooldown. */


const COOLDOWN_SECONDS = 40;


/* UTILITY FUNCTIONS */
function dbAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function dbRun(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

function normalizeSeatIds(seatIds) {
  return [...new Set(seatIds.map(Number).filter(Number.isInteger))].sort((a, b) => a - b);
}

function getCooldownCutoff() {
  return new Date(Date.now() - COOLDOWN_SECONDS * 1000).toISOString();
}

async function getRecentlyReleasedSeatIds(userId) {
  const rows = await dbAll(
    'SELECT seat_id FROM released_seats WHERE user_id = ? AND released_at >= ?',
    [userId, getCooldownCutoff()]
  );
  return new Set(rows.map(row => row.seat_id));
}


/* DAO-proper FUNCTIONS */
function getTheaterMap(user) {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT s.id, s.row_label, s.row_order, s.seat_number, s.category,
             r.owner_id, u.name AS owner_name
      FROM seats s
      LEFT JOIN reservation_seats rs ON rs.seat_id = s.id
      LEFT JOIN reservations r ON r.id = rs.reservation_id
      LEFT JOIN users u ON u.id = r.owner_id
      ORDER BY s.row_order, s.seat_number
    `;
    db.all(sql, [], (err, rows) => {
      if (err) { reject(err); return; }

      const rowsMap = new Map();
      for (const row of rows) {
        if (!rowsMap.has(row.row_label)) rowsMap.set(row.row_label, []);
        rowsMap.get(row.row_label).push({
          id: row.id,
          label: `${row.row_label}${row.seat_number}`,
          category: row.category,
          reserved: row.owner_id !== null,
          mine: user ? row.owner_id === user.id : false,
          cooldown: false,
          reservation: row.owner_id !== null
            ? { ownerId: row.owner_id, ownerName: row.owner_name }
            : null,
        });
      }

      resolve({
        rows: [...rowsMap.entries()]
          .map(([label, seats]) => ({ label, seats }))
          .sort((a, b) => a.label.localeCompare(b.label)),
      });
    });
  });
}

function getSeatsByUser(userId) {
  return new Promise((resolve, reject) => {
    db.all(`
      SELECT s.id, s.row_label, s.row_order, s.seat_number, s.category,
             r.id AS reservation_id, r.created_at
      FROM seats s
      JOIN reservation_seats rs ON rs.seat_id = s.id
      JOIN reservations r ON r.id = rs.reservation_id
      WHERE r.owner_id = ?
      ORDER BY s.row_order, s.seat_number
    `, [userId], (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function getReservationById(reservationId) {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM reservations WHERE id = ?', [reservationId], (err, row) => {
      if (err) reject(err);
      else resolve(row || null);
    });
  });
}

function getAllReservationsWithSeats() {
  return dbAll(`
    SELECT s.id, s.row_label, s.row_order, s.seat_number, s.category,
           r.id AS reservation_id, r.owner_id, r.created_at,
           u.name AS owner_name, u.username AS owner_username
    FROM seats s
    JOIN reservation_seats rs ON rs.seat_id = s.id
    JOIN reservations r ON r.id = rs.reservation_id
    JOIN users u ON u.id = r.owner_id
    ORDER BY r.id, s.row_order, s.seat_number
  `);
}

/* funzione per creare prenotazioni (dirette), ownerId esplicito, skipCooldown opzionale */

async function createReservation(ownerId, seatIds, skipCooldownCheck = false) {
  const normalizedSeatIds = normalizeSeatIds(seatIds);
  if (normalizedSeatIds.length === 0) throw new Error('At least one seat must be selected!');

  const placeholders = normalizedSeatIds.map(() => '?').join(', ');

  const seats = await dbAll(
    `SELECT id FROM seats WHERE id IN (${placeholders})`,
    normalizedSeatIds
  );
  if (seats.length !== normalizedSeatIds.length) throw new Error('One or more seats do not exist!');

  const occupiedSeats = await dbAll(
    `SELECT seat_id FROM reservation_seats WHERE seat_id IN (${placeholders})`,
    normalizedSeatIds
  );
  if (occupiedSeats.length > 0) throw new Error('One or more seats are already reserved!');

  if (!skipCooldownCheck) {
    const cooldownIds = await getRecentlyReleasedSeatIds(ownerId);
    for (const seatId of normalizedSeatIds) {
      if (cooldownIds.has(seatId)) throw new Error('One or more seats are still on cooldown for this user!');

    }
  }

  const now = new Date().toISOString();
  const reservation = await dbRun(
    'INSERT INTO reservations (owner_id, created_at, updated_at) VALUES (?, ?, ?)',
    [ownerId, now, now]
  );
  for (const seatId of normalizedSeatIds) {
    await dbRun(
      'INSERT INTO reservation_seats (reservation_id, seat_id) VALUES (?, ?)',
      [reservation.lastID, seatId]
    );
  }
  return { reservation_id: reservation.lastID, seat_ids: normalizedSeatIds };
}

/* Assegna posti in base a categoria e numero richiesti, cerca di mantenere posti contigui se possibile */
async function assignReservation(user, count, category) {
  const requestedCount = Number(count);
  if (!Number.isInteger(requestedCount) || requestedCount < 1)
    throw new Error('The number of seats must be a positive integer!');
  if (category !== 'normal' && category !== 'premium')
    throw new Error('The requested category is not valid');

  const seats = await dbAll(
    `SELECT id, row_label, seat_number, category FROM seats WHERE category = ? ORDER BY row_order, seat_number`,
    [category]
  );

  const occupiedSeats = await dbAll('SELECT seat_id FROM reservation_seats', []);
  const occupiedSet = new Set(occupiedSeats.map(row => row.seat_id));
  const cooldownIds = await getRecentlyReleasedSeatIds(user.id);
  const availableSeats = seats.filter(s => !occupiedSet.has(s.id) && !cooldownIds.has(s.id));

  if (availableSeats.length < requestedCount)
    throw new Error(`Not enough seats of type ${category}!`);

  // cerca una fila con abbastanza posti contigui
  let chosenSeats = [];
  const seatsByRow = new Map();
  for (const seat of availableSeats) {
    if (!seatsByRow.has(seat.row_label)) seatsByRow.set(seat.row_label, []);
    seatsByRow.get(seat.row_label).push(seat);
  }
  for (const rowSeats of seatsByRow.values()) {
    if (rowSeats.length >= requestedCount) {
      chosenSeats = rowSeats.slice(0, requestedCount);
      break;
    }
  }
  if (chosenSeats.length === 0) chosenSeats = availableSeats.slice(0, requestedCount);

  const now = new Date().toISOString();
  const reservation = await dbRun(
    'INSERT INTO reservations (owner_id, created_at, updated_at) VALUES (?, ?, ?)',
    [user.id, now, now]
  );
  for (const seat of chosenSeats) {
    await dbRun('INSERT INTO reservation_seats (reservation_id, seat_id) VALUES (?, ?)',
      [reservation.lastID, seat.id]);
  }
  return { reservation_id: reservation.lastID, seat_ids: chosenSeats.map(s => s.id) };
}

/* Fix: usa transazione per garantire che entrambe le DELETE avvengano */
async function deleteReservation(reservationId) {
  await dbRun('DELETE FROM reservation_seats WHERE reservation_id = ?', [reservationId]);
  await dbRun('DELETE FROM reservations WHERE id = ?', [reservationId]);
}

function getSeatsByReservation(reservationId) {
  return dbAll(`
    SELECT s.id, s.row_label, s.row_order, s.seat_number, s.category
    FROM seats s
    JOIN reservation_seats rs ON rs.seat_id = s.id
    WHERE rs.reservation_id = ?
    ORDER BY s.row_order, s.seat_number
  `, [reservationId]);
}

function addReleasedSeats(userId, seatIds) {
  if (seatIds.length === 0) return Promise.resolve();
  const now = new Date().toISOString();
  const placeholders = seatIds.map(() => '(?, ?, ?)').join(', ');
  const params = seatIds.flatMap(seatId => [userId, seatId, now]);
  return dbRun(
    `INSERT INTO released_seats (user_id, seat_id, released_at) VALUES ${placeholders}`,
    params
  );
}

export default {
  getTheaterMap,
  getSeatsByUser,
  getReservationById,
  getAllReservationsWithSeats,
  createReservation,        
  assignReservation,
  deleteReservation,
  getSeatsByReservation,
  addReleasedSeats,
};