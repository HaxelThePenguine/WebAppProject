[![Review Assignment Due Date](https://classroom.github.com/assets/deadline-readme-button-22041afd0340ce965d47ae6ef1cefeee28c7c493a6346c4f15d667ab976d596c.svg)](https://classroom.github.com/a/qm-fpFT_)
# Exam #1: "theater"
## Student: s362925 Martino Rocco 

## React Client Application Routes

- Route `/`: main theater page with the seat map, direct booking, and automatic booking form.
- Route `/login`: login page with username/password and optional TOTP second factor.
- Route `/reservations`: list of the logged user reservations, or all reservations for a TOTP admin.
- Route `*`: fallback page shown when the route does not exist.

## API Server

* **POST `/api/sessions`**: authenticate a user with mail and password.
  - **Request**: JSON object with `mail` and `password`.
    ```
    { "mail": "gianni@example.com", "password": "password" }
    ```
  - **Response body**: the logged user object, or an error object if authentication fails.
  - **Codes**: `200 OK`, `401 Unauthorized`, `400 Bad Request`, `500 Internal Server Error`.

* **GET `/api/sessions/current`**: get the current logged-in user.
  - **Request**: no parameters.
  - **Response body**: the current user object if the session is valid.
  - **Codes**: `200 OK`, `401 Unauthorized`.

* **DELETE `/api/sessions/current`**: logout the current user.
  - **Request**: no parameters.
  - **Response body**: empty object.
  - **Codes**: `200 OK`.

* **POST `/api/login-totp`**: perform the second factor authentication through TOTP.
  - **Request**: JSON object with the verification code.
    ```
    { "code": "123456" }
    ```
  - **Response body**: fixed JSON object on success.
  - **Codes**: `200 OK`, `401 Unauthorized`, `400 Bad Request`, `503 Service Unavailable`.

* **GET `/api/theater`**: get the theater map.
  - **Request**: no parameters.
  - **Response body**: theater object with rows, seats, categories, and reservation status.
  - **Codes**: `200 OK`.

* **GET `/api/my-seats`**: get the seats booked by the logged user.
  - **Request**: no parameters.
  - **Response body**: list of seat objects for the current user.
  - **Codes**: `200 OK`, `401 Unauthorized`.

* **GET `/api/admin/reservations`**: get all reservations with seat details.
  - **Request**: no parameters.
  - **Response body**: list of reservations with seats and owner information.
  - **Codes**: `200 OK`, `401 Unauthorized`.

* **POST `/api/reservations/direct`**: create a reservation using selected seats.
  - **Request**: JSON object with `seatIds`.
    ```
    { "seatIds": [1, 2, 3] }
    ```
  - **Response body**: created reservation object.
  - **Codes**: `201 Created`, `401 Unauthorized`, `422 Unprocessable Entity`, `400 Bad Request`.

* **POST `/api/reservations/assign`**: automatically assign a reservation.
  - **Request**: JSON object with `count` and `category`.
    ```
    { "count": 2, "category": "normal" }
    ```
  - **Response body**: created reservation object.
  - **Codes**: `201 Created`, `401 Unauthorized`, `422 Unprocessable Entity`, `400 Bad Request`.

* **POST `/api/reservations/modify`**: update an existing reservation.
  - **Request**: JSON object with `oldReservationId` and `seatIds`.
    ```
    { "oldReservationId": 1, "seatIds": [4, 5] }
    ```
  - **Response body**: updated reservation object.
  - **Codes**: `201 Created`, `401 Unauthorized`, `403 Forbidden`, `404 Not Found`, `422 Unprocessable Entity`.

* **DELETE `/api/reservations/:id`**: delete a reservation.
  - **Request**: `id` path parameter.
  - **Response body**: confirmation object after releasing the related seats.
  - **Codes**: `200 OK`, `401 Unauthorized`, `403 Forbidden`, `404 Not Found`.

## Database Tables

- Table `users` - registered users.
  - Columns: `id` (primary key), `username`, `mail`, `name`, `hash`, `salt`, `isAdmin`, `secret`, `lastTotpStep`.
- Table `seats` - all theater seats and their static properties.
  - Columns: `id` (primary key), `row_label`, `row_order`, `seat_number`, `category`.
- Table `reservations` - reservation headers, one row per booking.
  - Columns: `id` (primary key), `owner_id`, `created_at`, `updated_at`.
- Table `reservation_seats` - association table between reservations and seats.
  - Columns: `reservation_id`, `seat_id`.
- Table `released_seats` - tracks seats released after a reservation is modified or deleted.
  - Columns: `id` (primary key), `user_id`, `seat_id`, `released_at`.

## Main React Components

- `AppLayout` (in `AppLayout.jsx`): main page layout with navbar, login/logout area, and shared outlet.
- `SeatMap` (in `seats.jsx`): renders the theater grid and shows seat status with colors and labels.
- `ReservationsList` (in `ReservationsList.jsx`): shows the user's reservations or the admin view, and supports edit/delete actions.
- `LoginLayout` and `TotpLayout` (in `Layout.jsx`): wrapper pages for login and second-factor authentication, only to select the appropiate pages from  (`Auth.jsx`).
- `LoginForm` and `TotpForm` (in `Auth.jsx`): forms used to authenticate with password and optional TOTP code.
- `NotFoundLayout` (in `Layout.jsx`): fallback view for invalid routes.



## Screenshot

![Screenshot](./img/screenshot.png)

## Users Credentials


-luca@example.com , password 
-maria@example.com , password (ADMIN)
-gianni@example.com , password (ADMIN)
-elena@example.com , password 


