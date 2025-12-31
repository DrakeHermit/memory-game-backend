# Memory Game - Backend

The backend server for the Memory Game multiplayer functionality. Built with Express and Socket.IO to handle real-time game state synchronization between multiple players.

## Table of contents

- [Overview](#overview)
  - [Purpose](#purpose)
  - [Features](#features)
- [My process](#my-process)
  - [Built with](#built-with)
  - [Project Structure](#project-structure)
  - [Key Features Implementation](#key-features-implementation)
  - [What I learned](#what-i-learned)
  - [Continued development](#continued-development)
- [Getting Started](#getting-started)
- [API Reference](#api-reference)

## Overview

### Purpose

This backend serves as the game server for the Memory Game multiplayer mode. It handles:
- Room creation and management
- Player sessions and reconnection
- Real-time game state synchronization
- Turn-based game logic validation
- Win condition detection

### Features

#### Room Management
- **Create Rooms**: Generate private game rooms with configurable settings
- **Join/Leave Rooms**: Handle player entry and exit with proper cleanup
- **Room Capacity**: Support for 2-4 players per room
- **Host Controls**: Room creator has special privileges (start game, restart)

#### Player Management
- **Player Registration**: Persistent player IDs via socket registration
- **Reconnection Support**: Players can reconnect to existing games after disconnect
- **Name Changes**: Players can update their display name before game starts
- **Ready System**: Non-host players must mark ready before game can begin

#### Game Logic
- **Grid Generation**: Server-side generation of shuffled coin grids
- **Turn Management**: Validates that only the current player can flip coins
- **Match Detection**: Server-authoritative match checking with delayed flip-back
- **Score Tracking**: Tracks pairs found and moves for each player
- **Win Detection**: Determines winner or tie when all pairs are matched

#### Real-Time Features
- **WebSocket Communication**: Bi-directional real-time updates via Socket.IO
- **State Broadcasting**: Game state updates sent to all room participants
- **Pause/Resume**: Any player can pause; only pauser can resume
- **Player Left Handling**: Graceful turn transfer when player disconnects mid-game

## My process

### Built with

- [Node.js](https://nodejs.org/) - JavaScript runtime
- [Express 5](https://expressjs.com/) - Web framework for Node.js
- [Socket.IO](https://socket.io/) - Real-time bidirectional event-based communication
- [TypeScript](https://www.typescriptlang.org/) - Typed superset of JavaScript
### Project Structure

```
backend/
├── index.ts                 # Main entry point, Express & Socket.IO setup
│
├── utils/
│   ├── roomManager.ts       # Room CRUD operations (create, join, leave, remove)
│   └── gameManager.ts       # Game state management & logic
│
├── types/
│   └── roomTypes.ts         # TypeScript interfaces for Room data
│
├── dist/                    # Compiled JavaScript output
│
├── package.json
├── tsconfig.json
└── render.yaml              # Render deployment configuration
```

### Key Features Implementation

#### Socket Event Architecture

The server handles the following socket events:

```typescript
// Connection & Registration
'register'            // Register player ID with socket, handle reconnection

// Room Management
'createRoom'          // Create new game room with settings
'joinRoom'            // Join existing room by ID
'leaveRoom'           // Leave current room
'removeRoom'          // Delete room (host only)

// Player Actions
'changePlayerName'    // Update player display name
'togglePlayerReady'   // Toggle ready status

// Game Flow
'startGame'           // Begin game (host only, all players ready)
'pauseGame'           // Pause current game
'resumeGame'          // Resume paused game (pauser only)
'resetGame'           // Reset game state

// Gameplay
'flipCoin'            // Flip a coin (current player only)
'getGameState'        // Request current game state
'rejoinRoom'          // Rejoin room after disconnect
```

#### Room Manager

Handles room lifecycle using an in-memory Map:

- **createRoom**: Validates room doesn't exist, initializes room data with host
- **joinRoom**: Validates capacity and duplicate joins, adds player to room
- **leaveRoom**: Removes player, updates player count
- **removeRoom**: Deletes room from memory

#### Game Manager

Manages game state and logic:

- **Player Management**: Add/remove players, change names, toggle ready
- **Game Flow**: Start game, pause/resume, reset, game over detection
- **Turn System**: Track current player, validate turn ownership, rotate turns
- **Coin Logic**: Flip coins, check matches, track matched pairs
- **Winner Detection**: Calculate scores, detect ties, determine winner(s)

#### Match Checking Flow

```
1. Player flips second coin
2. Server marks game as "processing"
3. Server emits current state to all clients
4. After 500ms delay:
   - Check if coins match
   - If match: Add to matchedPairs, increment score
   - If no match: Emit 'flipCoinsBack' to clients
   - Rotate turn to next player
   - Check if all pairs matched (game over)
5. Emit updated state to all clients
```

#### Player Reconnection

```typescript
// On 'register' event:
1. Map playerId to current socket.id
2. If roomId provided:
   - Fetch game state for room
   - Check if player exists in game
   - If yes: Rejoin socket room, emit current state
3. Emit 'registered' with reconnection status
```

### What I learned

- **Real-time game server architecture**: Designing server-authoritative game logic with client-side prediction
- **Socket.IO room management**: Using socket rooms for targeted broadcasting to game participants
- **Turn-based validation**: Ensuring game integrity by validating all actions server-side
- **Graceful disconnection handling**: Managing player disconnects mid-game without breaking game state
- **TypeScript with Node.js**: Strong typing for socket events and game state

### Continued development

Future improvements could include:

- Refactor folder structure to use controllers for better separation of concerns
- Refactor state update handling to reduce code duplication in socket event handlers
- Add database persistence for game state and player statistics

## Getting Started

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Set up environment variables**
   Create a `.env` file:
   ```env
   PORT=3000
   FRONTEND_URL=http://localhost:5173
   ```

4. **Start development server**
   ```bash
   npm run dev
   ```

## API Reference

### HTTP Endpoints

| Method | Endpoint  | Description                    |
|--------|-----------|--------------------------------|
| GET    | `/health` | Health check, returns status and timestamp |

### Socket Events (Client → Server)

| Event              | Payload                                                    | Description                          |
|--------------------|------------------------------------------------------------|--------------------------------------|
| `register`         | `{ playerId, roomId? }`                                    | Register player, attempt reconnect   |
| `createRoom`       | `{ roomId, maxPlayers, theme, gridSize, playerName, playerId }` | Create new game room           |
| `joinRoom`         | `{ roomId, playerName, playerId }`                         | Join existing room                   |
| `leaveRoom`        | `{ roomId, playerId }`                                     | Leave current room                   |
| `removeRoom`       | `{ roomId, playerId }`                                     | Delete room                          |
| `changePlayerName` | `{ roomId, newName, playerId }`                            | Update player name                   |
| `togglePlayerReady`| `{ roomId, playerId }`                                     | Toggle ready status                  |
| `startGame`        | `{ roomId, playerId }`                                     | Start the game                       |
| `pauseGame`        | `{ roomId, playerId }`                                     | Pause the game                       |
| `resumeGame`       | `{ roomId, playerId }`                                     | Resume paused game                   |
| `flipCoin`         | `{ roomId, playerId, coinId }`                             | Flip a coin                          |
| `getGameState`     | `{ roomId, playerId? }`                                    | Request current state                |
| `resetGame`        | `{ roomId, playerId }`                                     | Reset game                           |

### Socket Events (Server → Client)

| Event              | Payload                                        | Description                          |
|--------------------|------------------------------------------------|--------------------------------------|
| `registered`       | `{ success, reconnected }`                     | Registration confirmation            |
| `roomCreated`      | `{ roomId, room }`                             | Room created successfully            |
| `joinRoom`         | `roomId`                                       | Successfully joined room             |
| `playerJoined`     | `{ playerId, playerName, currentPlayers, maxPlayers }` | New player joined           |
| `playerLeftRoom`   | `{ playerId, playerLeftDuringGame, leftPlayerName }` | Player left the room          |
| `gameState`        | `{ gameState }`                                | Current game state                   |
| `gameStarted`      | -                                              | Game has begun                       |
| `gamePaused`       | -                                              | Game was paused                      |
| `gameResumed`      | -                                              | Game was resumed                     |
| `flipCoinsBack`    | `number[]`                                     | Coins to flip back (no match)        |
| `roomRemoved`      | `{ roomId }`                                   | Room was deleted                     |
| `playerNameChanged`| `{ playerId, newName }`                        | Player name updated                  |
| `*Error`           | `{ message }`                                  | Various error events                 |

