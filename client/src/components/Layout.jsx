import { Row, Col, Button } from 'react-bootstrap';
import { Link,useOutletContext } from 'react-router';

import { LoginForm, TotpForm } from './Auth';
function NotFoundLayout() {
  return (
    <>
      <Link to="/">
        <Button  className="toast-message errorOut">Page Not Found! Go back to the main page!</Button>
      </Link>
    </>
  );
}


function LoginLayout(props) {
    const { setMessage } = useOutletContext();
    return (
      <Row>
        <Col>
          <LoginForm login={props.login} />
        </Col>
      </Row>
    );
}

function TotpLayout(props) {
  return (
    <Row>
      <Col>
        <TotpForm totpSuccessful={props.totpSuccessful} setLoggedIn={props.setLoggedIn} />
      </Col>
    </Row>
  );
}

export { NotFoundLayout, LoginLayout, TotpLayout };