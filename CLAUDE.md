# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

UIGen is an AI-powered React component generator with live in-browser preview. Users describe components in a chat interface, Claude generates the code via tool calls, and the result renders live in a sandboxed iframe — no files are written to disk.

## Commands

- `npm run setup` — install deps, generate Prisma client, run migrations (first-time setup)
- `npm run dev` — start dev server with Turbopack (requires `node-compat.cjs` shim via NODE_OPTIONS)
- `npm run build` — production build
- `npm run lint` — ESLint
- `npm test` — run all tests with Vitest (jsdom environment)
- `npx vitest run src/components/chat/__tests__/MessageInput.test.tsx` — run a single test file
- `npx prisma migrate dev` — apply schema changes
- `npm run db:reset` — reset database (destructive)

## Architecture

### AI Chat Flow

1. **Client**: `ChatProvider` (`src/lib/contexts/chat-context.tsx`) uses Vercel AI SDK's `useChat` hook, sending messages + serialized virtual file system to `/api/chat`
2. **Server**: `POST /api/chat` (`src/app/api/chat/route.ts`) streams responses via `streamText` with two tools: `str_replace_editor` and `file_manager`. These tools operate on a server-side `VirtualFileSystem` instance. On finish, project data is persisted to SQLite via Prisma.
3. **Client tool replay**: `FileSystemProvider` (`src/lib/contexts/file-system-context.tsx`) receives tool calls via `onToolCall` and replays them against the client-side `VirtualFileSystem`, keeping both sides in sync.

### Virtual File System

`VirtualFileSystem` (`src/lib/file-system.ts`) is the core abstraction — an in-memory tree of `FileNode` objects (files and directories). It's used both server-side (in the API route) and client-side (in React context). It supports serialization/deserialization for transport over the wire.

### Live Preview Pipeline

`PreviewFrame` (`src/components/preview/PreviewFrame.tsx`) watches the file system context for changes, then:
1. `createImportMap` (`src/lib/transform/jsx-transformer.ts`) transforms all JSX/TSX files via Babel standalone, creates blob URLs, builds an ES module import map (third-party deps resolve to esm.sh)
2. `createPreviewHTML` generates a full HTML document with the import map, injects it into a sandboxed iframe via `srcdoc`

### Mock Provider

When `ANTHROPIC_API_KEY` is not set, `MockLanguageModel` (`src/lib/provider.ts`) returns canned tool-call responses so the app runs without an API key. It implements the Vercel AI SDK `LanguageModelV1` interface.

### Auth & Data

- JWT session auth via `jose` (not NextAuth) — see `src/lib/auth.ts` and `src/middleware.ts`
- Prisma with SQLite (`prisma/schema.prisma`): `User` and `Project` models. Messages and file system data stored as JSON strings. Always reference `prisma/schema.prisma` to understand the database structure.
- Anonymous users can use the app without auth; authenticated users get project persistence.

### Path Alias

`@/*` maps to `./src/*` (configured in tsconfig.json).

## UI Components

Uses shadcn/ui components in `src/components/ui/` with Radix primitives and Tailwind CSS v4.

## Code Style

- Use comments sparingly. Only comment complex code.
