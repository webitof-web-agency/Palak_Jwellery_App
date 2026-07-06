# Jewellery Sales Management System

Monorepo for a jewellery sales workflow with a Node.js API, React admin panel, and Flutter mobile app.

## Overview

This project is split into three parts:

- `backend/` - REST API, authentication, suppliers, sales, QR parsing
- `admin-panel/` - React admin dashboard for suppliers, users, and sales
- `mobile/` - Flutter Android app for salesman login, scanner, and sale entry

## Repository Layout

```text
JwelleryCustomApp/
├── backend/         Node.js + Express API
├── admin-panel/     React 19 + Vite admin dashboard
├── mobile/          Flutter 3.41.6 Android app
├── docs/            PRD, TRD, and project notes
├── qr-samples/      Sample QR formats for parser testing
└── app logos/       Logo and favicon variants
```

## Tech Stack

- Backend: Node.js, Express, MongoDB, Mongoose, JWT, bcrypt
- Admin Panel: React 19, Vite, Tailwind CSS v4, Zustand, React Router
- Mobile App: Flutter 3.41.6, Riverpod, Dio, flutter_secure_storage, mobile_scanner

## Current Scope

- Admin login and role-based access
- Salesman login on mobile
- Supplier setup and QR test tooling in the admin panel
- QR parsing and normalization
- Mobile QR scan to sale-entry flow
- Admin sales and supplier management

## Prerequisites

- Node.js 20+
- npm
- Flutter 3.41.6 stable
- Android Studio or Android platform tools
- MongoDB locally or a hosted MongoDB URI

## Quick Start

### 1. Backend

```powershell
cd backend
npm install
npm run dev
```

### 2. Admin Panel

```powershell
cd admin-panel
npm install
npm run dev
```

### 3. Mobile App

```powershell
cd mobile
flutter pub get
flutter run
```

## Mobile API Configuration

The mobile app reads the backend URL from:

- `mobile/lib/core/constants/api_constants.dart`

Current setup:

- Default dev URL is used when no build-time override is provided
- You can override the backend URL at build time with `--dart-define`

Examples:

```powershell
flutter run --dart-define=API_BASE_URL=http://192.168.1.37:3000
flutter build apk --release --dart-define=API_BASE_URL=https://your-host.com
```

## Flutter Commands

### Run

```powershell
cd mobile
flutter run
```

If you want to override the backend URL while running:

```powershell
flutter run --dart-define=API_BASE_URL=http://192.168.1.37:3000
```

### Debug Build

```powershell
cd mobile
flutter build apk --debug
```

### Release Build

```powershell
cd mobile
flutter build apk --release --dart-define=API_BASE_URL=https://your-host.com
```

### Release App Bundle

```powershell
cd mobile
flutter build appbundle --release --dart-define=API_BASE_URL=https://your-host.com
```

### Clean

```powershell
cd mobile
flutter clean
flutter pub get
```

## Output Files

- Debug APK: `mobile/build/app/outputs/flutter-apk/app-debug.apk`
- Release APK: `mobile/build/app/outputs/flutter-apk/app-release.apk`
- Release AAB: `mobile/build/app/outputs/bundle/release/app-release.aab`

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

## Useful Scripts

### Backend

- `npm run dev` - start API in normal mode
- `npm run dev:watch` - start API with file watch
- `npm run start` - start API normally
- `npm run seed` - seed initial data

### Admin Panel

- `npm run dev` - start Vite dev server
- `npm run build` - build production assets
- `npm run lint` - run ESLint

## QR Testing

Sample QR strings live in `qr-samples/`.

Backend parser test helpers:

- `backend/src/scripts/test-qr-parser.js`
- `backend/src/scripts/test-qr-ingestion.js`

## Notes

- The project is built in slices and is still under active development.
- QR parsing is supplier-specific and designed to fail safely.
- The admin panel and mobile app both support light and dark themes.
- Mobile JWTs are stored in secure storage.

## Documentation

- `docs/PRD.md` - product requirements
- `docs/TRD.md` - technical requirements
- `AGENTS.md` - project operating instructions for agents
