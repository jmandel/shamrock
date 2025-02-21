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
          <Board roomId={currentRoom.id} data={{room: [currentRoom]}} playerName={myPlayerName!} />
        )}
      </div>
      <button onClick={resetRoom} className="reset-button">
        Reset Room
      </button>
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
    // Draw all tiles at once for all players -- now 8 per player (4 clue + 4 potential distractors)
    const numPlayers = Object.keys(room.players || {}).length;
    const allTiles = shuffleArray(shamrock as string[][]).slice(0, 8 * numPlayers);
    
    db.transact([
      tx.room[room.id].update({ 
        name: room.name,
        status: 'cluing', 
        guessingViewState: { boardRotation: 0 },
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