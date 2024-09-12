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
    <div style={styles.container}>
      <div style={styles.gameContainer}>
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
      <button onClick={resetRoom} style={styles.resetButton}>
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
          tilesAsGuessed: []
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
    db.transact([
      tx.room[room.id].update({ 
        name: room.name,
        status: 'cluing', 
        guessingViewState: { boardRotation: 0 },
        players: Object.fromEntries(
          Object.keys(room.players || {}).map(playerName => {
            const tiles = drawTiles();
            return [playerName, {
              name: playerName,
              tilesAsClued: tiles.slice(0, 4).map(rotateArray),
              tilesAsGuessed: shuffleArray(tiles.map(rotateArray))
            }]
          })
        )
      })
    ]);
  };

  const playersInGame = Object.keys(room.players || {});

  return (
    <div style={styles.gatheringContainer}>
      <h2 style={styles.title}>Join the Game</h2>
      <div style={styles.playerList}>
        <h3 style={styles.subtitle}>Players:</h3>
        {playersInGame.length === 0 ? (
          <em>None yet, please join.</em>
        ) : (
          playersInGame.map(playerName => (
            <div key={playerName} style={styles.playerItem}>
              <span>{playerName}{playerName === myPlayerName && " (You)"}</span>
              <button onClick={() => removePlayer(playerName)} style={styles.removeButton}>
                Remove
              </button>
            </div>
          ))
        )}
      </div>
      
      {!playersInGame.includes(myPlayerName || '') && (
        <form onSubmit={addNewPlayer} style={styles.joinForm}>
          <input
            type="text"
            value={newPlayerName}
            onChange={(e) => setNewPlayerName(e.target.value)}
            placeholder="Enter your name"
            style={styles.input}
          />
          <button type="submit" style={styles.joinButton}>
            Join&nbsp;Game
          </button>
        </form>
      )}
      <button onClick={beginGame} disabled={playersInGame.length < 1} style={styles.beginButton}>
        Begin Game
      </button>
    </div>
  );
}

function drawTiles(): string[][] {
  return shuffleArray(shamrock as string[][]).slice(0, 5);
  // return []
}

function shuffleArray<T>(array: T[]): T[] {
  const newArray = [...array]
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]]
  }
  return newArray
}

function rotateArray<T>(array: T[]): T[] {
  const cutpoint = Math.floor(Math.random() * array.length);
  return [...array.slice(cutpoint), ...array.slice(0, cutpoint)];
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    boxSizing: 'border-box',
    backgroundColor: '#fafafa',
    fontFamily: 'code, monospace',
    maxHeight: '100dvh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    letterSpacing: '2px',
    fontSize: '50px',
    color: 'lightgray',
    marginBottom: '10px',
    textAlign: 'center',
  },
  gameContainer: {
    flexGrow: 1,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: 'calc(min(200vw,100dvh))',
    aspectRatio: '1/2',
  },
  resetButton: {
    position: 'fixed',
    bottom: '10px',
    right: '10px',
    padding: '5px 10px',
    fontSize: '12px',
    backgroundColor: '#f0f0f0',
    border: '1px solid #ccc',
    borderRadius: '3px',
    cursor: 'pointer',
  },
  gatheringContainer: {
    backgroundColor: '#ffffff',
    borderRadius: '8px',
    padding: '20px',
    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
    maxWidth: '400px',
    width: '100%',
  },
  title: {
    fontSize: '24px',
    marginBottom: '20px',
    textAlign: 'center',
    color: '#333',
  },
  subtitle: {
    fontSize: '18px',
    marginBottom: '10px',
    color: '#555',
  },
  playerList: {
    marginBottom: '20px',
  },
  playerItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '8px',
  },
  removeButton: {
    backgroundColor: '#ff4d4d',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    padding: '4px 8px',
    cursor: 'pointer',
    fontSize: '12px',
  },
  joinForm: {
    display: 'flex',
    marginBottom: '20px',
  },
  input: {
    flex: 1,
    padding: '8px',
    fontSize: '16px',
    borderRadius: '4px',
    border: '1px solid #ccc',
    marginRight: '8px',
  },
  joinButton: {
    backgroundColor: '#4CAF50',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    padding: '8px 16px',
    cursor: 'pointer',
    fontSize: '16px',
  },
  beginButton: {
    backgroundColor: '#2196F3',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    padding: '10px 20px',
    cursor: 'pointer',
    fontSize: '18px',
    width: '100%',
  },
}

export default App