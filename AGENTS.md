# Repository Guidelines

## Project Structure

ViewportStudio is a React and TypeScript Chrome extension built with Vite. The workspace UI starts in `src/App.tsx`; `src/main.tsx` is the extension page entry point and `src/overlay.tsx` is the injected workspace entry point. Feature logic is grouped under `src/features/` (navigation, settings, synchronization, and viewport management). Shared UI lives in `src/components/`, state in `src/stores/`, and reusable hooks, utilities, types, and device presets have their own directories. The service worker is `src/background/service-worker.ts`; extension metadata and icons are in `manifest.json` and `public/icons/`. The preview bridge lives in `public/preview-frame.html` and `public/preview-frame.js`; these are runtime assets, not sample documentation. Treat `dist/` as generated build output and do not edit it by hand.

## Build and Development

Use pnpm, as shown in the lockfile and README:

- `pnpm install` installs dependencies.
- `pnpm dev` starts the Vite development server.
- `pnpm build` type-checks and builds the extension page and injected overlay into `dist/`. Vite copies `public/` runtime assets and the build emits `manifest.json`; root-level docs are not packaged.
- `pnpm package:chrome` runs the build, copies it into the ignored `ViewportStudio/` folder, and refreshes `downloads/ViewportStudio-Chrome.zip` with only the built extension for standalone downloads.
- `pnpm lint` runs ESLint; `pnpm typecheck` runs the TypeScript check; `pnpm test:unit` runs the Node unit tests.
- `pnpm format` formats TypeScript and TSX files with Prettier. It writes changes; there is no separate format-check script.

Load the generated `dist/` directory as an unpacked extension in Chrome to try it in the browser. For routine validation, run the build, lint, type-check, and relevant unit tests. Browser interaction and extension permission behavior still need manual Chrome verification when changed.

## Code Style and Naming

Follow the existing TypeScript and React patterns: two-space indentation, double-quoted imports, no semicolons, and Prettier formatting. Imports are sorted by the configured Prettier plugins. Use PascalCase for React components and component files, camelCase for functions and utilities, and `use`-prefixed names for hooks. Keep feature-specific behavior within its `src/features/<area>/` module and use the `@/` alias for imports from `src/`.

## Changes and Commits

Recent history uses Conventional Commit-style subjects such as `feat: add viewport layout and zoom controls`, `fix: ...`, and `docs: ...`. Keep commits focused and describe the change in an imperative, concise subject. Pull requests should explain the user-visible change, note relevant validation (`pnpm build`, `pnpm lint`, or `pnpm typecheck`), link related issues when applicable, and include screenshots for UI changes.

## Configuration and Safety

Keep extension permissions in `manifest.json` limited to what the feature requires. Site access and framing behavior affect users' browsing context, so document permission or host-access changes in the pull request. Never commit secrets, local credentials, or generated build output.
