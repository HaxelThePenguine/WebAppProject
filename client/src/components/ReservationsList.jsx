import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router';
import { SeatMap } from './seats.jsx';
import API from '../API.jsx';

export const ReservationsList = ({ loggedInTotpAdmin }) => {
  const { setMessage } = useOutletContext();
  const [seats, setSeats] = useState([]);
  const [theater, setTheater] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [draftSeatIds, setDraftSeatIds] = useState([]);
  // const [message, setMessage] = useState(null);

  const loadSeats = () => {
    const call = loggedInTotpAdmin ? API.getAllReservationsAdmin() : API.getMySets();
    return call
      .then(data => setSeats(data))
      .catch(err => setMessage(err.error || 'Errore nel caricamento'));
  };

  const loadTheater = () => API.getTheater()
    .then(data => setTheater(data))
    .catch(err => setMessage(err.error || 'Errore caricamento mappa'));

  useEffect(() => {
    Promise.all([loadSeats(), loadTheater()]).finally(() => setLoading(false));
  }, []);

  // Raggruppa i posti per reservation_id -> { '1': [seat, seat], '2': [seat] }
  const grouped = seats.reduce((acc, seat) => {
    if (!acc[seat.reservation_id]) acc[seat.reservation_id] = [];
    acc[seat.reservation_id].push(seat);
    return acc;
  }, {});

  const reservationIds = Object.keys(grouped);




  const handleDelete = async (reservationId) => {
    try {
      await API.deleteReservation(reservationId);
      if (expandedId === reservationId) setExpandedId(null);
      if (editingId === reservationId) setEditingId(null);
      await loadSeats();
      await loadTheater();
      setMessage('Reservation deleted successfully.');
    } catch (err) {
      setMessage(err.error || 'Error during deletion!');
    }
  };

  const handleStartEdit = (reservationId, reservationSeats) => {
    setEditingId(reservationId);
    setExpandedId(null);
    setDraftSeatIds(reservationSeats.map(s => s.id));
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setDraftSeatIds([]);
  };

  const handleSeatClick = (seat) => {
    if (seat.reserved && !seat.mine) return;
    setDraftSeatIds(prev =>
      prev.includes(seat.id)
        ? prev.filter(id => id !== seat.id)
        : [...prev, seat.id]
    );
  };

  const canInteractSeat = (seat) => !seat.cooldown && !(seat.reserved && !seat.mine);

  const handleSaveEdit = async () => {
    if (draftSeatIds.length === 0) return setMessage('Select at least one seat.');
    try {
      await API.modifyReservation(Number(editingId), draftSeatIds);
      setEditingId(null);
      setDraftSeatIds([]);
      await loadSeats();
      await loadTheater();
      setMessage('Reservation modified successfully.');
    } catch (err) {
      setMessage(err.error || 'Error during modification!');
    }
  };

  if (loading) return (
    <div className="reservation-list-loading d-flex justify-content-center align-items-center">
      <div className="spinner-border text-light" role="status" />
    </div>
  );

  return (
    <div className="panel-shell p-4 mt-3">
      <h2 className="section-title mb-1">
        {loggedInTotpAdmin ? 'All Reservations' : 'Your Reservations'}
      </h2>
      <p className="reservation-list-intro mb-4">
        {loggedInTotpAdmin
          ? 'You are viewing all users\' reservations (admin mode).'
          : 'Summary of the seats you have booked.'}
      </p>

      {error && (
        <div className="reservation-list-error mb-3 px-3 py-2 d-flex justify-content-between align-items-center">
          <span>{error}</span>
          <button onClick={() => setError(null)} style={{ background: 'none', border: 'none', color: '#ff9a9a', cursor: 'pointer' }}>✕</button>
        </div>
      )}

      {reservationIds.length === 0 ? (
        <div className="empty-state text-center py-5">
          <p className="reservation-list-empty-text">No reservations found.</p>
        </div>
      ) : (
        reservationIds.map(reservationId => {
          const reservationSeats = grouped[reservationId];
          const isExpanded = expandedId === reservationId;
          const isEditing = editingId === reservationId;

          return (
            <div key={reservationId} className="reservation-card active-reservation p-4 mb-3">
              <div className="reservation-card-body d-flex justify-content-between align-items-start flex-wrap">

                {/* Info */}
                <div>
                  <div className="reservation-meta mb-2">
                    RESERVATION #{reservationId}
                    {/* mostra il nome del proprietario solo se è l'admin a guardare(superflueo maybe visto che solo admin vede le altre reservations ma vabbeeee) */}
                    {loggedInTotpAdmin && (
                      <span className="ms-2" style={{ color: '#f4b942' }}>
                        — {reservationSeats[0].owner_name}
                      </span>
                    )}
                  </div>

                  <div className="reservation-seat-group d-flex flex-wrap gap-2">
                    {reservationSeats.map(seat => (
                      <div
                        key={seat.id}
                        className={`seat-button reservation-seat-tile d-inline-flex flex-column align-items-center justify-content-center gap-1 ${seat.category === 'premium' ? 'seat-premium' : 'seat-mine'}`}
                      >
                        <span className="seat-code">{seat.row_label}{seat.seat_number}</span>
                        <span className="seat-category">{seat.category === 'premium' ? 'P' : 'N'}</span>
                      </div>
                    ))}
                  </div>

                  <div className="reservation-date mt-2">
                    Booked on {new Date(reservationSeats[0].created_at).toLocaleDateString('en-US', {
                      day: '2-digit', month: 'long', year: 'numeric'
                    })}
                  </div>
                </div>

                {/* Bottoni */}
                <div className="d-flex gap-2 flex-wrap mt-2">
                  {!isEditing ? (
                    <>
                      <button
                        className={`seat-button d-inline-flex flex-column align-items-center justify-content-center gap-1 ${isExpanded ? 'seat-mine' : 'seat-free'}`}
                        style={{ width: 'auto', padding: '0.5rem 1.1rem', minHeight: 'unset' }}
                        onClick={() => setExpandedId(isExpanded ? null : reservationId)}
                      >
                        {isExpanded ? 'Hide Map' : 'View on Map'}
                      </button>
                      <button
                        className="seat-button d-inline-flex flex-column align-items-center justify-content-center gap-1 seat-premium"
                        style={{ width: 'auto', padding: '0.5rem 1.1rem', minHeight: 'unset' }}
                        onClick={() => handleStartEdit(reservationId, reservationSeats)}
                      >
                        Edit
                      </button>
                      <button
                        className="reservation-delete-button"
                        onClick={() => handleDelete(reservationId)}
                      >
                        Delete
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        className="seat-button d-inline-flex flex-column align-items-center justify-content-center gap-1 seat-added"
                        style={{ width: 'auto', padding: '0.5rem 1.1rem', minHeight: 'unset' }}
                        onClick={handleSaveEdit}
                      >
                        Save changes
                      </button>
                      <button
                        className="seat-button d-inline-flex flex-column align-items-center justify-content-center gap-1 seat-reserved-other"
                        style={{ width: 'auto', padding: '0.5rem 1.1rem', minHeight: 'unset' }}
                        onClick={handleCancelEdit}
                      >
                        Cancel
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Mappa visualizzazione */}
              {isExpanded && theater && !isEditing && (
                <div className="mt-4">
                  <SeatMap
                    theater={theater}
                    baselineSeatIds={reservationSeats.map(s => s.id)}
                    draftSeatIds={reservationSeats.map(s => s.id)}
                    onSeatClick={null}
                    canInteractSeat={() => false}
                    loggedIn={true}
                  />
                </div>
              )}

              {/* Mappa modifica */}
              {isEditing && theater && (
                <div className="mt-4">
                  <p className="reservation-date mb-3">
                    Click on the seats to add or remove them. Blue = current, green = added, crossed = removed.
                  </p>
                  <SeatMap
                    theater={theater}
                    baselineSeatIds={reservationSeats.map(s => s.id)}
                    draftSeatIds={draftSeatIds}
                    onSeatClick={handleSeatClick}
                    canInteractSeat={canInteractSeat}
                    loggedIn={true}
                  />
                  <p className="reservation-date mt-2">
                    Selected seats: {draftSeatIds.length}
                  </p>
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
};