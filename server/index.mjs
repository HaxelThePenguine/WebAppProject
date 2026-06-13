
import express from 'express';
import morgan from 'morgan';
import { check, validationResult, param } from 'express-validator'; // rimosso oneOf
import cors from 'cors';
import passport from 'passport';
import LocalStrategy from 'passport-local';
import { TOTP } from 'otpauth';
import session from 'express-session';

import userDao from './dao-users.mjs';
import daoTheater from './dao-theater.mjs';

/* Server for the theater reservation system. 
It provides APIs for user authentication, 
theater map retrieval, and reservation management. */


const app = express();
app.use(morgan('dev'));
app.use(express.json());

// 127.0.0.1:5173 è l'indirizzo di default usato da Vite, se il client è avviato con `npm run dev`.
// quindi andrebbe inserito anche lui ma assolutamente la specifica è localhost:5173 ergo ho manetnuto localhost.
// potrebbe essere anche una traduzione automatica che vsCode fa quando si usa localhost comunque,
// basta aggiungere dopo la prima specifica " , 'http://127.0.0.1:5173' ".

const corsOptions = {
  origin: ['http://localhost:5173'],
  credentials: true,
};
app.use(cors(corsOptions));

passport.use(new LocalStrategy({ usernameField: 'mail' },
  async function verify(mail, password, callback) {
    const user = await userDao.getUser(mail, password);
    if (!user) return callback(null, false, 'Incorrect mail or password!');
    return callback(null, user);
  }
));
passport.serializeUser((user, cb) => cb(null, user));
passport.deserializeUser((user, cb) => cb(null, user));

app.use(session({
  secret: '586e60fdeb6f34186ae165a0cea7ee1dfa4105354e8c74610671de0ef9662191',
  resave: false,
  saveUninitialized: false,
}));
app.use(passport.initialize());
app.use(passport.session());



// Functions Middleware AUTH
const isLoggedIn = (req, res, next) =>
  req.isAuthenticated() ? next() : res.status(401).json({ error: 'Not authenticated !' });

const isTotp = (req, res, next) =>
  req.session.method === 'totp' ? next() : res.status(401).json({ error: 'Missing TOTP authentication !' });

function getRequestContext(req) {
  if (!req.isAuthenticated()) return null;
  return {
    id: req.user.id,
    username: req.user.username,
    isAdmin: Boolean(req.user.isAdmin),
  };
}

function clientUserInfo(req) {
  const user = req.user;
  return {
    id: user.id,
    username: user.username,
    name: user.name,
    canDoTotp: Boolean(user.secret),
    isTotp: req.session.method === 'totp',
    isAdmin: Boolean(user.isAdmin),
  };
}

function verifyTotpToken(user, token) {
  const totp = new TOTP({ algorithm: 'SHA1', digits: 6, period: 30, secret: user.secret });
  const delta = totp.validate({ token, window: 1 });
  if (delta === null) return false;
  const actualStep = totp.counter() + delta;
  if (actualStep <= user.lastTotpStep) return false;
  user.lastTotpStep = actualStep;
  return true;
}

/* API AUTH */
app.post('/api/sessions', (req, res, next) => {
  passport.authenticate('local', (err, user, info) => {
    if (err) return next(err);
    if (!user) return res.status(401).json({ error: info });
    req.login(user, (err) => {
      if (err) return next(err);
      return res.json(clientUserInfo(req));
    });
  })(req, res, next);
});

app.post('/api/login-totp', isLoggedIn, async (req, res) => {
  if (!req.user.secret) return res.status(400).json({ error: 'Cannot authenticate with TOTP !' });
  const success = verifyTotpToken(req.user, req.body.code);
  if (!success) return res.status(401).json({ error: 'Cannot authenticate with TOTP !' });
  req.session.method = 'totp';
  try {
    await userDao.updateLastTotpStep(req.user.id, req.user.lastTotpStep);
    return res.json({ otp: 'authorized' });
  } catch (err) {
    return res.status(503).json({ error: 'Database error !' });
  }
});

app.get('/api/sessions/current', (req, res) => {
  if (req.isAuthenticated()) res.json(clientUserInfo(req));
  else res.status(401).json({ error: 'Not authenticated !' });
});
  // Logout API
app.delete('/api/sessions/current', (req, res) => {
  req.logout(() => res.json({}));
});



/* API map THEATER */ 
app.get('/api/theater', async (req, res, next) => {
  try {
    const map = await daoTheater.getTheaterMap(getRequestContext(req));
    return res.json(map);
  } catch (err) { return next(err); }
});

/* API per la gestione delle prenotazioni mi da le seats dell'utente loggato */
app.get('/api/my-seats', isLoggedIn, async (req, res, next) => {
  try {
    const seats = await daoTheater.getSeatsByUser(req.user.id);
    return res.json(seats);
  } catch (err) { return next(err); }
});

/* API admin per visualizzare tutte le prenotazioni con i posti associati */
app.get('/api/admin/reservations', isLoggedIn, isTotp, async (req, res, next) => {
  try {
    const reservations = await daoTheater.getAllReservationsWithSeats();
    return res.json(reservations);
  } catch (err) { return next(err); }
});

/** API per creare una prenotazione specificando i posti desiderati */
app.post('/api/reservations/direct', isLoggedIn,
  [
    check('seatIds').isArray({ min: 1 }),
    check('seatIds.*').isInt({ min: 1 }),
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array().map(e => e.msg) });
    try {
      const reservation = await daoTheater.createReservation(req.user.id, req.body.seatIds);
      return res.status(201).json(reservation);
    } catch (err) { // Se l'errore è dovuto al cooldown o a vincoli del database
      console.error("Errore durante la prenotazione diretta:", err.message);
      
      return res.status(400).json({ 
        error: err.message || 'Error during direct reservation !' });
    }
  }
);

/** API per creare una prenotazione specificando categoria e numero di posti desiderati */
app.post('/api/reservations/assign', isLoggedIn,
  [
    check('count').isInt({ min: 1 }),
    check('category').isIn(['normal', 'premium']),
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array().map(e => e.msg) });
    try {
      const reservation = await daoTheater.assignReservation(
        getRequestContext(req), Number(req.body.count), req.body.category
      );
      return res.status(201).json(reservation);
    } catch (err) { // Se l'errore è dovuto al cooldown o a vincoli del database
      console.error("Errore durante la prenotazione automatica:", err.message);
      
      return res.status(400).json({ 
        error: err.message || 'Error during automatic reservation !' });
    }
  }
);

/** API per cancellare una prenotazione */
app.delete('/api/reservations/:id', isLoggedIn,
  param('id').isInt({ min: 1 }),
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });
    try {
      const reservationId = parseInt(req.params.id);
      const context = getRequestContext(req);

      const reservation = await daoTheater.getReservationById(reservationId);
      if (!reservation) return res.status(404).json({ error: 'Reservation not found !' });

      if (reservation.owner_id !== context.id) {
        if (!context.isAdmin || req.session.method !== 'totp')
          return res.status(403).json({ error: 'Not authorized !' });
      }

      const seats = await daoTheater.getSeatsByReservation(reservationId);
      await daoTheater.deleteReservation(reservationId);
      await daoTheater.addReleasedSeats(reservation.owner_id, seats.map(s => s.id));
      return res.json({ message: 'Reservation deleted' });
    } catch (err) { return res.status(400).json({ error: 'Seat cannot be released !' }); }
  }
);

/** API per modificare una prenotazione  sia Normal user che Admin */
app.post('/api/reservations/modify', isLoggedIn,
  [
    check('oldReservationId').isInt({ min: 1 }),
    check('seatIds').isArray({ min: 1 }),
    check('seatIds.*').isInt({ min: 1 }),
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array().map(e => e.msg) });
    try {
      const context = getRequestContext(req);
      const { oldReservationId, seatIds } = req.body;
      const reservationId = Number(oldReservationId);

      const existing = await daoTheater.getReservationById(reservationId);
      if (!existing) return res.status(404).json({ error: 'Reservation not found' });
      if (existing.owner_id !== context.id) {
        if (!context.isAdmin || req.session.method !== 'totp')
          return res.status(403).json({ error: 'Not authorized !' });
      }

      const oldSeats = await daoTheater.getSeatsByReservation(reservationId);
      await daoTheater.deleteReservation(reservationId);

      const newSeatIdsSet = new Set(seatIds.map(Number));
      const seatsToRelease = oldSeats.filter(s => !newSeatIdsSet.has(s.id));
      if (seatsToRelease.length > 0)
        await daoTheater.addReleasedSeats(existing.owner_id, seatsToRelease.map(s => s.id));

      const newReservation = await daoTheater.createReservation(existing.owner_id, seatIds, true);
      return res.status(201).json(newReservation);
    } catch (err) { 
      //console.error("Errore durante la modifica della prenotazione:", err.message);

      return res.status(400).json({ error: err.message || 'Error during reservation modification !' });
    }
  }
);



// Activating the server
const PORT = 3001;
// Activate the server
app.listen(PORT, (err) => {
  if (err)
    console.log(err);
  else 
    console.log(`Server listening at http://localhost:${PORT}`);
}); 
