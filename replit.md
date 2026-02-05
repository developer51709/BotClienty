# BotClienty

## Overview
A Discord Bot Web Client with Direct Message (DM) support. This Next.js application allows users to interact with Discord through a web-based interface using their bot token.

## Features
- View all servers and channels
- Send and receive messages
- Direct message support
- Rich embeds and attachments
- Message reactions
- Server member list

## Technical Stack
- **Framework**: Next.js 13.5.6 (App Router)
- **Language**: TypeScript
- **UI**: React 18.2.0
- **Styling**: CSS (globals.css)

## Project Structure
```
/app
  /api          - API routes
  client.tsx    - Main client component
  layout.tsx    - Root layout
  page.tsx      - Main page
  globals.css   - Global styles
/public         - Static assets
```

## Running the Project
- Development: `npm run dev` (runs on port 5000)
- Production build: `npm run build`
- Production start: `npm run start`

## Configuration
- The app runs on port 5000 for both development and production
- Host is set to 0.0.0.0 to allow external access
