# Workshop Management — Android App

A workshop-management application packaged for Android with Capacitor.

## Verified project structure
- `www/`: web application interface and JavaScript logic
- `android/`: native Android/Gradle project
- `capacitor.config.json`: Capacitor app configuration
- `package.json`: Capacitor and SQLite dependencies

## Verified capabilities in the included source
- Client records: create, search, update and delete
- Vehicle records linked to clients
- Service records associated with vehicles
- Repair records associated with vehicles
- SQLite database schema with foreign-key relationships and indexes
- Search and edit flows for clients and vehicles

## Technologies
JavaScript · HTML · CSS · SQLite · Capacitor · Android / Java · Gradle

## Open in Android Studio
1. Install a compatible Android Studio and JDK.
2. Open the `android/` folder in Android Studio.
3. Let Gradle sync.
4. Configure the Android SDK locally. Do not commit `local.properties`.
5. Build and test on an emulator or device.

## Web assets and Capacitor
The source web application is in `www/`. The Android project's packaged web assets are under `android/app/src/main/assets/public/`.
If you change `www/`, install dependencies and run the appropriate Capacitor copy/sync workflow before rebuilding the Android app.

## Repository hygiene
Generated Gradle caches, build outputs and IDE workspace files are excluded from this portfolio copy. Do not commit signing keys, credentials, local SDK paths, personal databases or customer information.

## Current scope
This README documents functionality visible in the supplied source. Test all flows on a clean device before presenting it as production-ready.
