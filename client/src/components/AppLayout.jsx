'use strict';

import { Container, Nav, Navbar, Badge } from 'react-bootstrap';
import { Link, NavLink, Outlet, useNavigate } from 'react-router';

function AppLayout(props) {
  const navigate = useNavigate();

  async function handleLogout() {
    await props.logout();
    navigate('/');
  }

  return (
    <div className="app-background">
      <Navbar expand="lg" className="topbar px-3 py-3" variant="dark">
        <Container fluid className="px-0">
          <Navbar.Brand as={Link} to="/" className="brand-mark">
            Nuvola Theater
          </Navbar.Brand>
          <Navbar.Toggle aria-controls="main-navbar" />
          <Navbar.Collapse id="main-navbar" >
            <Nav className="me-auto gap-2">
              <Nav.Link as={NavLink} to="/" end>
                Map
              </Nav.Link>
              {props.loggedIn && (
                <Nav.Link as={NavLink} to="/reservations">
                  Reservations
                </Nav.Link>
              )}
            </Nav>
            <div className="d-flex align-items-center gap-3 flex-wrap">
              {props.loggedIn ? (
                <>
                  <span className="session-pill">
                    {props.user?.name || props.user?.username}
                    <span className="session-pill-subtitle">@{props.user?.username}</span>
                    {props.loggedInTotpAdmin ? (
                      <Badge bg="warning" text="dark" className="ms-2">TOTP</Badge>
                    ) : null}
                  </span>
                  <button type="button" className="btn btn-light btn-sm fw-semibold text-dark shadow-sm" onClick={handleLogout}>
                    Logout
                  </button>
                </>
              ) : (
                <Nav.Link as={NavLink} to="/login" className="btn btn-light btn-sm px-3 fw-semibold text-dark shadow-sm">
                  Login
                </Nav.Link>
              )}
            </div>
          </Navbar.Collapse>
        </Container>
      </Navbar>

      <Container fluid className="page-container py-4">
        <Outlet context={{ setMessage: props.setMessage }} />
      </Container>
    </div>
  );
}

export { AppLayout };

