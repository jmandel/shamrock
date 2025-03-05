import './App.css'
import { init, tx, id } from '@instantdb/react'
import Board from './Board'
import { APP_ID, Schema, Room } from './Types'
import { useState, useEffect } from 'react'
import shamrock from './shamrock.json'
import React from 'react';

const db = init<Schema>({ appId: APP_ID })

function App() {
  const [roomName, setRoomName] = useState('default')
  const [myPlayerName, setMyPlayerName] = useState<string | null>(localStorage.getItem('shamrockPlayerName'))

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const roomParam = params.get('room')
    if (roomParam) setRoomName(roomParam)

    const storedPlayerName = localStorage.getItem('shamrockPlayerName')
    if (storedPlayerName) setMyPlayerName(storedPlayerName)
  }, [])

  const { isLoading, error, data } = db.useQuery({ 
    room: {$: {where: {name: roomName}}}
  })

  if (isLoading) return <div>Fetching data...</div>
  if (error) return <div>Error fetching data: {error.message}</div>

  const { room } = data
  console.log("DATA", data)
  const currentRoom = room[0]

  // Create a new room if it doesn't exist
  if (!currentRoom) {
    db.transact([
      tx.room[id()].update({ name: roomName, status: 'gathering' })
    ]);
    return <div>Creating new room...</div>;
  }

  const resetRoom = () => {
    if (currentRoom) {
      db.transact([
        tx.room[currentRoom.id].update({
          name: roomName,
          status: 'gathering',
          players: {},  // Clear players
          guessingViewState: undefined,  // Clear game state
          deckState: undefined,  // Reset deck state for a fresh start
        })
      ]);
    }
  };

  const playAgain = () => {
    if (currentRoom) {
      const numPlayers = Object.keys(currentRoom.players || {}).length;
      const tilesNeeded = 8 * numPlayers; // 8 tiles per player (4 clued + 4 distractor)
      const numTileSets = (shamrock as string[][]).length;
      
      // Use the existing deck state if available
      let usedTileIndices: number[] = [];
      let newTileIndices: number[] = [];
      let allTiles: string[][];
      
      if (currentRoom.deckState) {
        // Get the previously used indices
        const previouslyUsed = currentRoom.deckState.usedTileIndices || [];
        
        // Get all available indices not yet used
        const allIndices = Array.from({ length: numTileSets }, (_, i) => i);
        const availableIndices = allIndices.filter(i => !previouslyUsed.includes(i));
        
        // If we've used all tiles, reset and start over
        if (availableIndices.length < tilesNeeded) {
          console.log("All cards used! Starting with a fresh deck.");
          // Create a completely new deck
          const freshIndices = shuffleArray([...allIndices]);
          newTileIndices = freshIndices.slice(0, tilesNeeded);
          usedTileIndices = newTileIndices; // Start with just the new tiles
        } else {
          // We have enough unused tiles, shuffle and take what we need
          const shuffledAvailable = shuffleArray(availableIndices);
          newTileIndices = shuffledAvailable.slice(0, tilesNeeded);
          usedTileIndices = [...previouslyUsed, ...newTileIndices];
        }
        
        // Get the actual tile sets from the indices
        allTiles = newTileIndices.map(index => (shamrock as string[][])[index]);
      } else {
        // No existing deck state, create a new one (similar to beginGame)
        const totalIndices = Array.from({ length: numTileSets }, (_, i) => i);
        const shuffledIndices = shuffleArray(totalIndices);
        
        newTileIndices = shuffledIndices.slice(0, tilesNeeded);
        usedTileIndices = newTileIndices;
        
        // Get the actual tile sets from the indices
        allTiles = newTileIndices.map(index => (shamrock as string[][])[index]);
      }
      
      const resetPlayers = Object.fromEntries(
        Object.keys(currentRoom.players || {}).map((playerName, playerIndex) => {
          const playerTiles = allTiles.slice(playerIndex * 8, (playerIndex + 1) * 8);
          // Use same structure as in beginGame for consistent state
          return [playerName, {
            name: playerName,
            tilesAsClued: playerTiles.slice(0, 4).map(rotateArray),
            tilesForDistractors: playerTiles.slice(4, 8),
            tilesAsGuessed: [], // Will be populated when player submits clues
            readyToGuess: false,
            readyToJoin: false,
            numDistractors: currentRoom.players[playerName]?.numDistractors || 1, // Preserve player preference
            clues: []
          }];
        })
      );
      
      // Update everything in a single transaction
      db.transact([
        tx.room[currentRoom.id].update({
          name: roomName,
          status: 'cluing', // Go directly to cluing phase
          guessingViewState: { boardRotation: 0 },
          deckState: {
            usedTileIndices: usedTileIndices,
            totalTiles: numTileSets
          },
          players: resetPlayers
        })
      ]);
    }
  };

  return (
    <div className="container">
      <div className="game-container">
        {currentRoom.status === 'gathering' ? (
          <GatheringPhase 
            room={currentRoom} 
            myPlayerName={myPlayerName} 
            setMyPlayerName={setMyPlayerName} 
          />
        ) : (
          <Board 
            roomId={currentRoom.id} 
            data={{room: [currentRoom]}} 
            playerName={myPlayerName!}
            onPlayAgain={playAgain}
            onResetRoom={resetRoom}
          />
        )}
      </div>
    </div>
  )
}

function GatheringPhase({ room, myPlayerName, setMyPlayerName }: 
  { room: Room, myPlayerName: string | null, setMyPlayerName: (name: string) => void }) {
  const [newPlayerName, setNewPlayerName] = useState(myPlayerName || '');

  useEffect(() => {
    if (Object.keys(room.players || {}).length === 0 && myPlayerName) {
      if (newPlayerName === "") {
        setNewPlayerName(myPlayerName);
      }
    }
  }, [room.players, myPlayerName, newPlayerName]);

  const removePlayer = async (playerName: string) => {
    if (playerName === myPlayerName) {
      setMyPlayerName('');
      localStorage.removeItem('shamrockPlayerName');
    }

    await db.transact([
      tx.room[room.id].update({
        ...room,
        players: Object.fromEntries(
          Object.entries(room.players || {}).filter(([name]) => name !== playerName)
        )
      })
    ]);
  };

  const addNewPlayer = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPlayerName && !(newPlayerName in (room.players || {}))) {
      const addNew = {
        [newPlayerName]: {
          readyToGuess: false,
          readyToJoin: false,
          tilesAsClued: [],
          tilesForDistractors: [],
          tilesAsGuessed: [],
          numDistractors: 1,
          clues: []
        }
      }

      const removeOld = myPlayerName ? {
        [myPlayerName]: undefined
      } : {}

      db.transact([
        tx.room[room.id].merge({
          players: { ...removeOld, ...addNew}
        })
      ]);

      setMyPlayerName(newPlayerName);
      localStorage.setItem('shamrockPlayerName', newPlayerName);
    }
  };

  const beginGame = () => {
    // Initialize a new deck by creating a shuffled array of all available tile indices
    const numTileSets = (shamrock as string[][]).length;
    const totalIndices = Array.from({ length: numTileSets }, (_, i) => i); // [0, 1, 2, ..., numTileSets-1]
    const shuffledIndices = shuffleArray(totalIndices);
    
    // Draw the tiles needed for this game
    const numPlayers = Object.keys(room.players || {}).length;
    const tilesNeeded = 8 * numPlayers; // 8 tiles per player (4 clued + 4 distractor)
    
    // Take the first tilesNeeded tiles from the shuffled deck
    const usedTileIndices = shuffledIndices.slice(0, tilesNeeded);
    
    // Get the actual tile sets from the indices
    const allTiles = usedTileIndices.map(index => (shamrock as string[][])[index]);
    
    db.transact([
      tx.room[room.id].update({ 
        name: room.name,
        status: 'cluing', 
        guessingViewState: { boardRotation: 0 },
        // Store the deck state for future games - just track what's been used
        deckState: {
          usedTileIndices: usedTileIndices,
          totalTiles: numTileSets
        },
        players: Object.fromEntries(
          Object.keys(room.players || {}).map((playerName, playerIndex) => {
            const playerTiles = allTiles.slice(playerIndex * 8, (playerIndex + 1) * 8);
            return [playerName, {
              name: playerName,
              tilesAsClued: playerTiles.slice(0, 4).map(rotateArray),
              tilesForDistractors: playerTiles.slice(4, 8),
              tilesAsGuessed: [], // Will be populated when player submits clues
              readyToGuess: false,
              readyToJoin: false,
              numDistractors: 1, // Default value
              clues: []
            }]
          })
        )
      })
    ]);
  };

  const playersInGame = Object.keys(room.players || {});

  return (
    <div className="gathering-container">
      <h2 className="title">Join the Game</h2>
      <div className="player-list">
        <h3 className="subtitle">Players:</h3>
        {playersInGame.length === 0 ? (
          <em>None yet, please join.</em>
        ) : (
          playersInGame.map(playerName => (
            <div key={playerName} className="player-item">
              <span>{playerName}{playerName === myPlayerName && " (You)"}</span>
              <button onClick={() => removePlayer(playerName)} className="remove-button">
                Remove
              </button>
            </div>
          ))
        )}
      </div>
      
      {!playersInGame.includes(myPlayerName || '') && (
        <form onSubmit={addNewPlayer} className="join-form">
          <input
            type="text"
            value={newPlayerName}
            onChange={(e) => setNewPlayerName(e.target.value)}
            placeholder="Enter your name"
            className="input"
          />
          <button type="submit" className="join-button">
            Join&nbsp;Game
          </button>
        </form>
      )}
      <button onClick={beginGame} disabled={playersInGame.length < 1} className="begin-button">
        Begin Game
      </button>
    </div>
  );
}

export function shuffleArray<T>(array: T[]): T[] {
  const newArray = [...array]
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]]
  }
  return newArray
}

export function rotateArray<T>(array: T[]): T[] {
  const cutpoint = Math.floor(Math.random() * array.length);
  return [...array.slice(cutpoint), ...array.slice(0, cutpoint)];
}

export default App