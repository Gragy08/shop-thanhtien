# Shop Thanh Tien Admin

Admin-only management system for phones, watches, accessories, and other products.

## Setup

1. Copy `.env.example` to `.env` and configure MongoDB.
2. Run `npm install`.
3. Run `npm run seed:admin` once to create the initial hashed admin account.
4. Run `npm run dev`.
5. Check `http://127.0.0.1:3001/admin/health`.

The project uses Express, TypeScript, MongoDB/Mongoose, and Pug. Product inventory is received separately from product creation; serialized items use globally unique IMEI/serial identifiers.

Authentication uses an HTTP-only `tokenAdmin` cookie. The initial account is configured through `INITIAL_ADMIN_EMAIL`, `INITIAL_ADMIN_PASSWORD`, and `INITIAL_ADMIN_ROLE`; never commit `.env`.
