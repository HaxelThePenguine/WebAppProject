PRAGMA foreign_keys = ON;

-- Reset the database so the script can be re-run safely
DROP TABLE IF EXISTS released_seats;
DROP TABLE IF EXISTS reservation_seats;
DROP TABLE IF EXISTS reservations;
DROP TABLE IF EXISTS seats;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS theater_rows;

-- Users: username is the login field used by the server DAO
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    mail TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    hash TEXT NOT NULL,
    salt TEXT NOT NULL,
    isAdmin INTEGER NOT NULL DEFAULT 0,
    secret TEXT,
    lastTotpStep INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE seats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    row_label TEXT NOT NULL,
    row_order INTEGER NOT NULL,
    seat_number INTEGER NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('normal', 'premium')),
    UNIQUE(row_label, seat_number)
);

CREATE TABLE reservations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    owner_id INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE reservation_seats (
    reservation_id INTEGER NOT NULL,
    seat_id INTEGER NOT NULL UNIQUE,
    PRIMARY KEY (reservation_id, seat_id),
    FOREIGN KEY (reservation_id) REFERENCES reservations(id) ON DELETE CASCADE,
    FOREIGN KEY (seat_id) REFERENCES seats(id) ON DELETE CASCADE
);

CREATE TABLE released_seats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    seat_id INTEGER NOT NULL,
    released_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (seat_id) REFERENCES seats(id) ON DELETE CASCADE
);

-- Exactly 4 users, exactly 2 of them can act as admin.
-- Password for all users is: password
INSERT INTO users (id, username, mail, name, hash, salt, isAdmin, secret, lastTotpStep) VALUES
(1, 'luca', 'luca@example.com', 'Luca Neri', '1cfd6a1dea42b7cf3f13e7cf62c828721fc1c95d99b302b36e5de27a6116a807', 'salt_luca', 0, NULL, 0),
(2, 'gianni', 'gianni@example.com', 'Gianni Verdi', '3c8f9ee8dde7bacf9dc95b3b7af4e6f6a6ab7c1ac13585756d13a7b3a8e9af49', 'salt_gianni', 1, 'LXBSMDTMSP2I5XFXIYRGFVWSFI', 0),
(3, 'elena', 'elena@example.com', 'Elena Bianchi', '59a9260d93787325923590642544831eeb839778d7541f9cf627d1281090acca', 'salt_elena', 0, NULL, 0),
(4, 'maria', 'maria@example.com', 'Maria Rossi', '6feab44914ec4314689789b6a26516c0038a7aec09753362a69731d2a7b71bda', 'salt_maria', 1, 'LXBSMDTMSP2I5XFXIYRGFVWSFI', 0);

-- At least 4 rows, with at least 3 different lengths, and at least 100 seats overall.
-- First two rows are premium, the remaining rows are normal.
WITH rows_def(label, row_order, seat_count) AS (
    VALUES
    ('A', 1, 8),
    ('B', 2, 10),
    ('C', 3, 12),
    ('D', 4, 14),
    ('E', 5, 20),
    ('F', 6, 40)
),
cnt(n) AS (
    SELECT 1
    UNION ALL
    SELECT n + 1 FROM cnt WHERE n < 40
)
INSERT INTO seats (row_label, row_order, seat_number, category)
SELECT r.label,
       r.row_order,
       c.n,
       CASE WHEN r.row_order <= 2 THEN 'premium' ELSE 'normal' END
FROM rows_def AS r
JOIN cnt AS c ON c.n <= r.seat_count
ORDER BY r.row_order, c.n;

-- Exactly 4 reservations owned by exactly 2 users: one regular user and one admin user.
INSERT INTO reservations (id, owner_id, created_at, updated_at) VALUES
(1, 1, '2026-05-29T15:00:00.000Z', '2026-05-29T15:00:00.000Z'),
(2, 1, '2026-05-29T15:10:00.000Z', '2026-05-29T15:10:00.000Z'),
(3, 2, '2026-05-29T15:20:00.000Z', '2026-05-29T15:20:00.000Z'),
(4, 2, '2026-05-29T15:30:00.000Z', '2026-05-29T15:30:00.000Z');

-- Seed a few occupied seats. The remaining seats stay free, so the theater still has plenty of availability.
INSERT INTO reservation_seats (reservation_id, seat_id) VALUES
(1, (SELECT id FROM seats WHERE row_label = 'A' AND seat_number = 1)),
(1, (SELECT id FROM seats WHERE row_label = 'A' AND seat_number = 2)),
(2, (SELECT id FROM seats WHERE row_label = 'B' AND seat_number = 1)),
(3, (SELECT id FROM seats WHERE row_label = 'A' AND seat_number = 3)),
(3, (SELECT id FROM seats WHERE row_label = 'A' AND seat_number = 4)),
(4, (SELECT id FROM seats WHERE row_label = 'C' AND seat_number = 1));