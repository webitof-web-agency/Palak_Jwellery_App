# Jewellery Sales Management System

Monorepo for a jewellery sales workflow with a Node.js API, React admin panel, and Flutter mobile app.

## What It Does

- Admin login and role-based access
- Salesman login on mobile
- Supplier setup and QR parsing
- QR ingestion with parsed, final, and review states
- Mobile QR scan to sale-entry flow
- Admin sales and supplier management screens

## Repository Layout

```text
JwelleryCustomApp/
├── backend/       Node.js + Express API
├── admin-panel/   React 19 + Vite admin dashboard
├── mobile/        Flutter 3.41.6 Android app
├── docs/          PRD, TRD, and prompt docs
├── qr-samples/    Sample QR formats used for parser testing
└── app logos/     Logo and favicon variants
```

## Tech Stack

- Backend: Node.js, Express, MongoDB, Mongoose, JWT, bcrypt
- Admin Panel: React 19, Vite, Tailwind CSS v4, Zustand, React Router v7
- Mobile App: Flutter 3.41.6, Riverpod 2.x, Dio, flutter_secure_storage, mobile_scanner

## Current Scope

This repo currently includes:

- Authentication for admin and salesman users
- Supplier CRUD and QR test tooling in the admin panel
- QR parsers for supported supplier formats
- QR normalization and ingestion flow
- Mobile login, scanner, and sale-entry flow

## Quick Start

### 1. Backend

```bash
cd backend
npm install
npm run dev
```

### 2. Admin Panel

```bash
cd admin-panel
npm install
npm run dev
```

### 3. Mobile App

```bash
cd mobile
flutter pub get
flutter run
```

## Environment Variables

### Backend

Create `backend/.env` with at least:

```env
PORT=3000
MONGODB_URI=mongodb://127.0.0.1:27017/jwellery_app
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=8h
CORS_ORIGIN=http://localhost:5173
```

### Admin Panel

Create `admin-panel/.env` with:

```env
VITE_API_BASE_URL=http://localhost:3000
```

### Mobile App

Set the API base URL in:

- `mobile/lib/core/constants/api_constants.dart`

Use:

- `http://10.0.2.2:3000` for Android emulator
- `http://<your-laptop-ip>:3000` for a real phone on the same Wi-Fi

## Useful Scripts

### Backend

- `npm run dev` - start API in watch mode
- `npm run start` - start API normally
- `npm run seed` - seed initial data

### Admin Panel

- `npm run dev` - start Vite dev server
- `npm run build` - build production assets
- `npm run lint` - run ESLint

## QR Testing

Sample QR strings live in `qr-samples/`.

Backend parser checks:

- `backend/src/scripts/test-qr-parser.js`
- `backend/src/scripts/test-qr-ingestion.js`

## Notes

- The project is built in slices and is still under active development.
- QR parsing is supplier-specific and designed to fail safely.
- The admin panel and mobile app both support light and dark theme variants.
- Mobile app assets use secure storage for JWTs.

## Documentation

- `docs/PRD.md` - product requirements
- `docs/TRD.md` - technical requirements
- `AGENTS.md` - project operating instructions for agents

