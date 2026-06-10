import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.css';
import './App.css';


import dayjs from 'dayjs';

import { useState, useEffect } from 'react';
import { Container, Col, Form, Button } from 'react-bootstrap';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router';
import { AppLayout } from './components/AppLayout.jsx';
import { SeatMap } from './components/seats.jsx';
import { NotFoundLayout, LoginLayout, TotpLayout } from './components/Layout';
import { ReservationsList } from './components/ReservationsList.jsx';
import API from './API.js';



function AppContent() {
  const navigate = useNavigate(); 


  const [loggedIn, setLoggedIn] = useState(false);
  const [user, setUser] = useState(null);
  const [loggedInTotpAdmin, setLoggedInTotpAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [theater, setTheater] = useState(null);
  const [selectedSeatIds, setSelectedSeatIds] = useState([]);
  const [autoCount, setAutoCount] = useState(2);
  const [autoCategory, setAutoCategory] = useState('normal');
  

  const canInteractSeat = (seat) => !seat.reserved ;


  // Funzione per caricare la mappa del teatro
  const loadTheater = async () => {
    try {
      const map = await API.getTheater();
      setTheater(map);
    } catch (err) {
      setMessage(err?.error || 'Error loading theater map!');
    }
  };
  

  // The useEffect callback so on strartup we check if the user is already logged in (e.g., has a valid session cookie)
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const user = await API.getUserInfo();
        setLoggedIn(true);
        setUser(user);
        setLoggedInTotpAdmin(Boolean(user?.isTotp));
      } catch (err) {
        // not logged in
      } finally {
        setLoading(false);
      }
    };
    checkAuth();
    loadTheater(); // primo caricamento
  }, []);  



  // per ricaricare la mappa ogni volta che si torna alla home for login o logout
  const location = useLocation();

  useEffect(() => {
    if (location.pathname === '/') {
      loadTheater();
    }
  }, [location.pathname]);

  // per far sparire i messaggi dopo 2 secondi il problema è che , passati i 2 secondi
  // porta con se il restart di vari stati locali del login per esempio.
  // Tipo se stai modificando una prenotazione e dopo 2 sec arriva un messaggio di successo,
  // il refresh del singolo modulo tipo in login(altra route) ti fa perdere tutte le 'modifiche fatte' negli stati locali


  useEffect(() => {
    if (!message) return;
    if (location.pathname === '/login') return; // è una mitigazione 
    // la soluzione sarebbe gestire i messaggi in un contesto globale 
    // oppure imporre globalmente i vari stati di mofica dell'input
    // del login cosa che non mi sembra ottimale.

    const timer = setTimeout(() => setMessage(''), 2000);
    return () => clearTimeout(timer);
  }, [message, location.pathname]);


  /* ** This function handles the login process.
   * @param {Object} credentials - The user's login credentials.
   * @returns {Promise<void>} - A promise that resolves when the login process is complete.
   * @throws {Error} - Throws an error if the login process fails.
  */ 



  const handleLogin = async (credentials) => {
    try {
      const user = await API.logIn(credentials);
      setUser(user);
      setLoggedIn(true);
      setLoggedInTotpAdmin(false);
      setMessage('Successful login');
    } catch (err) {
      setMessage(err?.error || 'Error during login!');
      throw err;
    }
  };


  /**
   * This function handles the logout process.
  */ 
  const handleLogout = async () => {
    try {
      await API.logOut();
    } catch (err) {
      // Cannot do anything more if logout fails: just avoid uncaught rejected promise
      console.log(err);
    } finally {
      setLoggedIn(false);
      setLoggedInTotpAdmin(false);
      // clean up everything aggiornando però la mappa per non far vedere posti prenoati da altri utenti
      setUser(null);
      setMessage('Successful logout');
      loadTheater();

    }
  };


  const toggleSeat = (seat) => {
    if (!loggedIn) {
      // setMessage('Devi essere loggato per selezionare un posto.');
    return;
    }
    if (!canInteractSeat(seat)) return;

    setSelectedSeatIds((current) =>
      current.includes(seat.id)
        ? current.filter((id) => id !== seat.id)
        : [...current, seat.id]
    );
  };

  // Funzione per realizzare prenotaazioni dirette e automatiche, con gestione degli errori
  const handleDirectReservation = async () => {

    if (!selectedSeatIds.length) {
      // setMessage('Seleziona almeno un posto dalla mappa.');
      return;
    }

    try {
      await API.reserveSeats(selectedSeatIds);
      setSelectedSeatIds([]);
      setMessage('Direct reservation completed successfully.');
      await refreshTheater();
    } catch (err) {
      console.log(err);
      setMessage(err?.error || 'Error during direct reservation!');
    }
  };

  const refreshTheater = async () => {
    const map = await API.getTheater();
    setTheater(map);
  };

  function Login(props) {
    if (props.loggedIn) {
      if (props.user?.canDoTotp) {
        if (props.loggedInTotpAdmin) {
          setMessage('You are logged as admin'); // messaggio che è già loggato come admin
          // piccolo delay per far vedere il messaggio prima di tornare alla home
          setTimeout(() => {
            setMessage('');
          }, 3000);
          return <Navigate replace to='/' />;
        } else {
          return <TotpLayout totpSuccessful={() => props.setLoggedInTotpAdmin(true)} setLoggedIn={props.setLoggedIn} />;
        }
      } else {
        setMessage('Successful login, and you cannot access the admin area (NO TOTP)'); // messaggio che non può accedere all'area admin
        return <Navigate replace to='/' />;
      }
    } else {
      return <LoginLayout login={props.login} />;
    }
  }

  const handleAutomaticReservation = async (event) => {
    event.preventDefault();

    try {
      await API.assignSeats(Number(autoCount), autoCategory);
      setMessage('Automatic reservation completed successfully.');
      await refreshTheater();
    } catch (err) {
      setMessage(err?.error || 'Error during automatic reservation!');
    }
  };

  // Componente per mostrare i messaggi di successo o errore in un toast
  function Toast({ message, onClose }) {
  if (!message) return null;
 
  const isFail = message.toLowerCase().includes('!'); //  se il messaggio contiene "!" è un successo, altrimenti un errore
  console.log('Toast message:', message, 'isFail:', isFail); // Debug log
  return (
    <div className={`toast-message ${isFail ? 'error' : ''}`}>
      <span>{message}</span>
      <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: '1rem' }}>X</button>
    </div>
  );
}

  //gianni@example.com:password

  if (loading) {
    return <div className="p-4">Checking session...</div>;
  }

  return (
    <>
    <Toast message={message} onClose={() => setMessage('')} />
      <Routes>
        
        <Route element={<AppLayout loggedIn={loggedIn} user={user} loggedInTotpAdmin={loggedInTotpAdmin} logout={handleLogout} setMessage={setMessage} />}>
          <Route path="/"   element={ 
                              <Col xs={12} >
                                <div className="home-hero">
                                  {theater ? (
                                    <SeatMap
                                      theater={theater}
                                      draftSeatIds={selectedSeatIds}
                                      onSeatClick={toggleSeat}
                                      canInteractSeat={canInteractSeat}
                                      loggedIn={loggedIn}
                                    />
                                  ) : (
                                    <p>Caricamento mappa...</p>
                                  )}
                                  <div className="home-hero Assignment">
                                  <div className="d-flex justify-content-between align-items-center mb-3">
                                    <strong>Direct selected seats: {selectedSeatIds.length}</strong>
                                    <Button
                                      variant="warning"
                                      onClick={handleDirectReservation}
                                      disabled={!loggedIn || selectedSeatIds.length === 0}
                                      className="fw-semibold"
                                    >
                                      Book selection
                                    </Button>
                                  </div>

                                  <Form onSubmit={handleAutomaticReservation} className="d-grid gap-3">
                                    <Form.Group>
                                      <Form.Label>Number of seats</Form.Label>
                                      <Form.Control
                                        type="number"
                                        min="1"
                                        value={autoCount}
                                        onChange={(e) => setAutoCount(e.target.value)}
                                      />
                                    </Form.Group>

                                    <Form.Group>
                                      <Form.Label>Category</Form.Label>
                                      <Form.Select
                                        value={autoCategory}
                                        onChange={(e) => setAutoCategory(e.target.value)}
                                      >
                                        <option value="normal">Normal</option>
                                        <option value="premium">Premium</option>
                                      </Form.Select>
                                    </Form.Group>

                                    <Button type="submit" variant="info" disabled={!loggedIn}>
                                      Assign automatically
                                    </Button>
                                  </Form>
                                </div>
                                </div>
                              </Col>
                          } />
          <Route path="/login" element={
            <Login loggedIn={loggedIn}
             login={handleLogin}
              user={user}
               loggedInTotpAdmin={loggedInTotpAdmin}
                setLoggedInTotpAdmin={setLoggedInTotpAdmin}
                 setLoggedIn={setLoggedIn}/>} />
          <Route path="/reservations" element={loggedIn ? 
            (       <div className="p-4">
                      <ReservationsList 
                      loggedInTotpAdmin={loggedInTotpAdmin} />
                    </div>) : (
                    <Navigate replace to='/login' />
            )} 
          />
          <Route path="*" element={<NotFoundLayout />} />
        </Route>
        
      </Routes>
      
    </>
  )
}

function App() {
  return (
    <Container fluid className="p-0">
      <AppContent />
    </Container>
  )
}

export default App
