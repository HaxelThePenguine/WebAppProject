const SERVER_URL = 'http://localhost:3001/api/';

function getJson(promise) {
  return new Promise((resolve, reject) => {
    promise
      .then(res => {
        // 1. Proviamo a parsare il JSON in ogni caso
        return res.json()
          .then(data => {
            // 2. Una volta ottenuto il JSON, controlliamo lo stato HTTP
            if (res.ok) {
              resolve(data); // Stato 2xx -> Successo, passa i dati
            } else {
              reject(data);  // Stato 4xx/5xx -> Errore del server, passa il JSON di errore (es. {error: '...'})
            }
          })
          .catch(() => {
            // Questo catch intercetta solo se res.json() fallisce (es. il server risponde in HTML/Testo)
            reject({ error: 'Cannot parse server response!' });
          });
      })
      .catch(() => {
        // Questo catch intercetta gli errori di rete 
        reject({ error: 'Cannot communicate!' });
      });
  });
}
// Utility functions for making API calls to the server.
const get  = (path) => getJson(fetch(SERVER_URL + path, { credentials: 'include' }));
const del  = (path) => getJson(fetch(SERVER_URL + path, { method: 'DELETE', credentials: 'include' }));

const post = (path, body) => getJson(fetch(SERVER_URL + path, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include',
  body: JSON.stringify(body),
}));

// Auth
const getUserInfo = () => get('sessions/current');
const logOut      = () => del('sessions/current');
const logIn       = (credentials) => post('sessions', credentials);
const totpVerify  = (code) => post('login-totp', { code });

// Theater
const getTheater = () => get('theater');

// Reservations
const getMySets                = () => get('my-seats');
const getAllReservationsAdmin   = () => get('admin/reservations');
const deleteReservation        = (id) => del(`reservations/${id}`);

const assignSeats = async (numSeats, category) => {
  return post('reservations/assign', { count: numSeats, category });
};

const reserveSeats = async (seatIds) => {
  return post('reservations/direct', { seatIds });
};

const modifyReservation = async (oldReservationId, seatIds) => {
  return post('reservations/modify', { oldReservationId, seatIds });
};

const API = {
  getUserInfo, logIn, logOut, totpVerify,
  getTheater,
  getMySets, getAllReservationsAdmin,
  assignSeats, reserveSeats, modifyReservation, deleteReservation,
};

export default API;