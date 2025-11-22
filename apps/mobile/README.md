# Vision Navigation

A pnpm-powered Expo (React Native) application that prototypes an accessible navigation companion for people with visual impairments. The experience pairs Google Maps data with live location tracking, voice output, and large tactile controls.

## Highlights
- **Clean guidance UI** with a contrast-friendly map, always-visible status chip, and assistive action buttons.
- **Long-press destination pinning** plus audible prompts that explain what to do next.
- **Voice + haptics feedback** (expo-speech, expo-haptics) so users can hear surroundings and feel confirmations.
- **Google Maps tiles** powered by `react-native-maps` with Google as the provider.
- **EAS-ready setup** (`eas.json`, app config, pnpm scripts) for preview, development, and production builds.

## Requirements
- Node.js 18.18+ and pnpm 8+ (`corepack enable pnpm` is recommended).
- A Google Maps SDK key with Maps SDK for Android/iOS enabled.
- Expo CLI tooling (bundled through the local dependency) and, for builds, an Expo account.

## Environment variables
Set the maps key before running Metro/EAS. Expo automatically exposes any variable prefixed with `EXPO_PUBLIC_` to the app code/config.

```bash
export EXPO_PUBLIC_GOOGLE_MAPS_API_KEY="<your-key>"
# Optional: only needed after running `eas init` and receiving the UUID
export EXPO_PUBLIC_EAS_PROJECT_ID="<uuid-from-eas>"
```

> On managed builds, prefer `eas secret:create --name EXPO_PUBLIC_GOOGLE_MAPS_API_KEY --value <key>` so the key is stored securely.

## Scripts
| Command | Description |
| --- | --- |
| `pnpm start` | Launch Metro bundler with the Expo dev server. |
| `pnpm android` / `pnpm ios` / `pnpm web` | Quick-launch platform targets from Expo. |
| `pnpm typecheck` | Run TypeScript without emitting output. |
| `pnpm eas-build` | Convenience wrapper for `eas build --profile preview --platform all`. Requires Expo login & project ID. |

## EAS setup
1. Authenticate: `pnpm dlx eas login`.
2. Register the project (one-time): `pnpm dlx eas init` → copies the project ID into `EXPO_PUBLIC_EAS_PROJECT_ID`.
3. Provision credentials as needed (`eas credentials`).
4. Trigger builds (`pnpm eas-build` or directly via `pnpm dlx eas build --profile production --platform android`).

Profiles live in `eas.json`:
- `development`: internal distribution with the dev client (ideal for QA devices).
- `preview`: internal testing channel with auto version bumps.
- `production`: store-ready artifacts.

## Google Maps configuration
- The TypeScript config (`app.config.ts`) injects the API key into both Android (`android.config.googleMaps.apiKey`) and iOS (`ios.config.googleMapsApiKey`).
- Update the `bundleIdentifier` / `package` if you change the app slug.
- When testing on a physical device, ensure the key allows that bundle ID/SHA.

## Running locally
```bash
pnpm install
export EXPO_PUBLIC_GOOGLE_MAPS_API_KEY="<your-key>"
pnpm start
```
Open the Expo dev tools, scan the QR code (Expo Go) or press `a` / `i` for emulators. Grant location permission when prompted and long-press the map to drop a destination pin.

## Project structure (excerpt)
```
App.tsx                    # Main UI scene with the map & assistive controls
app.config.ts              # Dynamic Expo config + Google Maps key wiring
eas.json                   # Build/submit profiles
src/hooks/useAccessibleLocation.ts
src/components/            # AssistiveButton, InfoCard, StatusChip
src/utils/voiceAssistant.ts
src/theme/colors.ts        # Palette tokens for consistent contrast
```

## Next steps
- Replace placeholder bundle identifiers, register on EAS, and commit the generated project ID.
- Integrate turn-by-turn routing (e.g., Mapbox Directions API) for more precise instructions.
- Add automated testing (unit + detox) before shipping to stores.
