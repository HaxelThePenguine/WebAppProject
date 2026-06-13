
import { useState } from 'react';
import { Form, Button, Alert, Col, Row } from 'react-bootstrap';
import { useNavigate, useOutletContext } from 'react-router';
import API from '../API.jsx';

function formatErrorMessage(err, fallback) {
  if (typeof err === 'string') {
    return err;
  }

  if (err && typeof err === 'object') {
    if (typeof err.error === 'string') {
      return err.error;
    }

    if (err.error && typeof err.error.message === 'string') {
      return err.error.message;
    }

    if (typeof err.message === 'string') {
      return err.message;
    }
  }

  return fallback;
}

function TotpForm(props) {
  const { setMessage } = useOutletContext();
  const [totpCode, setTotpCode] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const navigate = useNavigate();

  //console.log('DEBUG: RENDER TotpForm');

  const doTotpVerify = () => {
    API.totpVerify(totpCode)
      .then(() => {
        setErrorMessage('');
        props.totpSuccessful();
        navigate('/');
      })
      .catch((err) => {
        const message = formatErrorMessage(err, 'Wrong code, please try again !');

        if (message === 'Not authenticated' || message === 'Not authorized') {
          setMessage('Your session has expired, you will be redirected to the login page !');
          setTimeout(() => props.setLoggedIn(false), 2000);
        } else {
          setMessage(message);
        }
      })
  }

  const handleSubmit = (event) => {
    event.preventDefault();
    setErrorMessage('');

    let valid = true;
    if (totpCode === '' || totpCode.length !== 6)
      valid = false;

    if (valid) {
      doTotpVerify(totpCode);
    } else {
      setMessage('Invalid content in form: either empty or not 6-char long !');
    }
  };

  return (
    <Row className="justify-content-center">
      <Col xs={12} md={10} lg={6} xl={5}>
        <section className="panel-shell auth-card p-4 p-lg-5 mx-auto">
        <h2>Second factor</h2>
        <h5>Enter the code from your authenticator app</h5>
        <Form onSubmit={handleSubmit}>
          {errorMessage ? <Alert variant='danger' dismissible onClick={() => setErrorMessage('')}>{errorMessage}</Alert> : ''}
          <Form.Group controlId='totpCode'>
            <Form.Label>TOTP code</Form.Label>
            <Form.Control type='text' value={totpCode} onChange={ev => setTotpCode(ev.target.value)} />
          </Form.Group>
          <Button className='my-2' type='submit'>Verify</Button>
          <Button className='my-2 mx-2' variant='danger' onClick={() => navigate('/')}>Skip</Button>
        </Form>
        </section>
      </Col>
    </Row>
  )

}

function LoginForm(props) {
  const [mail, setMail] = useState('gianni@example.com');
  const [password, setPassword] = useState('password');
  const [useTotp, setUseTotp] = useState(false);
  const { setMessage } = useOutletContext(); // contiene messaggi di errore o successo dopo il login


  const navigate = useNavigate(); 


  const handleSubmit = async (event) => {
    event.preventDefault();

    const credentials = { mail, password };

    if (!mail) {
      setMessage('Mail cannot be empty!');
    } else if (!password) {
      setMessage('Password cannot be empty!');
    } else {
      try {
        await props.login(credentials);
        //console.log('DEBUG: Login successful, checking if TOTP is needed...', props.user, useTotp);
        navigate(useTotp ? '/login' : '/');
      } catch (err) {
        setMessage(formatErrorMessage(err, 'Login failed'));
      }
    }
  };

  return (
    <Row className="justify-content-center">
      <Col xs={12} md={10} lg={6} xl={5}>
        <section className="panel-shell auth-card p-4 p-lg-5 mx-auto">
        <h1 className="pb-3">Login</h1>

        <Form onSubmit={handleSubmit}>
          <Form.Group className="mb-3">
            <Form.Label>Mail</Form.Label>
            <Form.Control
              type="email"
              value={mail} placeholder="Example: john.doe@polito.it"
              onChange={(ev) => setMail(ev.target.value)}
            />
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label>Password</Form.Label>
            <Form.Control
              type="password"
              value={password} placeholder="Enter your password"
              onChange={(ev) => setPassword(ev.target.value)}
            />
          </Form.Group>
          <Form.Check
            className="mb-3"
            type="checkbox"
            id="use-totp-after-login"
            label="Use TOTP after login"
            checked={useTotp}
            onChange={(ev) => setUseTotp(ev.target.checked)}
          />
          <Button className="mt-3 px-4 fw-semibold" type="submit">Login</Button>
        </Form>
        </section>
      </Col>
    </Row>

  )
};



export { LoginForm,  TotpForm };
