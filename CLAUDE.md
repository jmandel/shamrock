# Shamrock - Multiplayer Word Game

## Project Overview
Shamrock is a real-time multiplayer word tile game where players arrange words in circular patterns and create clues for others to guess. The game uses a draw-down deck system for unique experiences across multiple rounds.

## Architecture
- **Client-first Architecture**: All game logic runs client-side with InstantDB for real-time sync
- **State Management**: Direct sync with InstantDB, minimizing local state
- **Tech Stack**: React + TypeScript + Vite + InstantDB
- **CSS**: Uses CSS variables for theme consistency across light/dark modes

## Build & Development Commands
```
npm run dev         # Start development server
npm run build       # Build for production
npm run lint        # Run ESLint
npm run preview     # Preview production build
```

## Game Flow
1. **Gathering Phase**: Players join the room
2. **Cluing Phase**: 
   - Each player receives 4 word tiles to arrange in a circle
   - Players create clues for each quadrant
   - Players select distractor count (1-4) when ready
   - Progress bar shows percentage of players ready
   - Game advances when all players are ready

3. **Guessing Phase**:
   - Players select whose board to view from the Actions menu
   - Selected player's tiles (with distractors) are displayed
   - Players manipulate tiles to solve the puzzle

4. **Re-deal**:
   - Game tracks used tiles in a draw-down deck system
   - Previously used tiles won't appear until deck is exhausted
   - Actions menu shows remaining/total tiles

## Key Components

### Board.tsx
Core game component that manages:
- Game state transitions
- Tile layout and manipulation
- Player actions (Ready, Proceed)
- Real-time synchronization with InstantDB

### App.tsx
- Player management
- Room creation/reset
- Deck management for tile distribution

### Types.ts
Defines the game's data model, including:
- Room structure with players and game state
- Deck tracking system
- Tile definitions

## Design Philosophy
- **Minimalist UI**: Only show necessary controls when needed
- **Progressive Disclosure**: Reveal options contextually based on game phase
- **Consolidated Menus**: Group related actions into single control points
- **Visual Feedback**: Use progress indicators rather than numeric counters
- **Theme Adaptability**: Consistent experience across light/dark modes via CSS vars

## Implementation Details

### Deck System
- Tiles are drawn without replacement from a deck
- Used tile indices are tracked in `room.deckState.usedTileIndices`
- When deck depletes, unused tiles are reshuffled
- System ensures unique games until all tiles have been seen

### Ready & Proceed Flow
- Players select distractor count via "Ready..." dropdown
- Proceed button fills proportionally as players get ready
- When all players are ready, Proceed button activates

### Guessing Interface
- All player options are grouped under "Guess" in the Actions menu
- Current player selection is indicated with a checkmark
- Menu structure adapts based on game phase

## CSS Variables
- `--action-blue`: Primary action color
- `--background-gray`: Background for progress indicators
- `--ready-green`: Color for ready state actions
- `--text-on-dark`: Text color for buttons with dark backgrounds
- `--dropdown-disabled`: Text color for disabled dropdown options