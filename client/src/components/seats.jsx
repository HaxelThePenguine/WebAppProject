
function SeatLegend() {
  return (
    <div className="seat-legend d-flex flex-wrap gap-3">
      <span className="d-inline-flex align-items-center"><i className="legend-swatch swatch-free" /> free</span>
      <span className="d-inline-flex align-items-center"><i className="legend-swatch swatch-premium" /> premium</span>
      <span className="d-inline-flex align-items-center"><i className="legend-swatch swatch-mine" /> mine</span>
      <span className="d-inline-flex align-items-center"><i className="legend-swatch swatch-other" /> reserved</span>
    </div>
  );
}

function SeatMap({ theater, baselineSeatIds = [], draftSeatIds = [], onSeatClick, canInteractSeat, loggedIn }) {
  const baseline = new Set(baselineSeatIds);
  const draft = new Set(draftSeatIds);

  if (!theater) {
    return null;
  }

  return (
    <section className="panel-shell seat-map-shell p-4">
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-3">
        <div>
          <h2 className="section-title mb-1">Theater map</h2>
          <p className="text-light-emphasis mb-0">Colors show the current booking status for every seat.</p>
        </div>
        <SeatLegend />
      </div>

      <div className="seat-map-grid">
        {theater.rows.map((row) => (
          <div key={row.label} className="seat-row">
            <div className="row-label d-flex align-items-center justify-content-center">{row.label}</div>
            <div className="seat-row-grid d-flex flex-wrap gap-2">
              {row.seats.map((seat) => {
                const inBaseline = baseline.has(seat.id);
                const inDraft = draft.has(seat.id);
                const selectable = loggedIn && (canInteractSeat ? canInteractSeat(seat) : true);

                let className = 'seat-button d-inline-flex flex-column align-items-center justify-content-center gap-1';

                if (seat.reserved && seat.mine) {
                  className += inDraft ? ' seat-mine' : ' seat-removed';
                } else if (seat.reserved) {
                  className += ' seat-reserved-other';
                } else if (inDraft && !inBaseline) {
                  className += ' seat-added';
                } else {
                  className += seat.category === 'premium' ? ' seat-premium' : ' seat-free';
                }

                const titleParts = [
                  seat.label,
                  seat.category,
                  seat.reserved ? `reserved by ${seat.mine ? 'you' : seat.reservation.ownerName}`
                    : 'free',
                ];

                return (
                  <button
                    key={seat.id}
                    type="button"
                    className={className}
                    title={titleParts.join(' · ')}
                    disabled={!selectable}
                    onClick={() => onSeatClick?.(seat)}
                  >
                    <span className="seat-code">{seat.label}</span>
                    <span className="seat-category">{seat.category === 'premium' ? 'P' : 'N'}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export { SeatLegend, SeatMap };

