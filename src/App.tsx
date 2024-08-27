import './App.css'
import { init, tx, id } from '@instantdb/react'
import Board from './Board'
import { APP_ID, Schema, Room } from './Types'
import { useState, useEffect } from 'react'
import shamrock from './shamrock.json'

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
  const [newPlayerName, setNewPlayerName] = useState(myPlayerName);

  useEffect(() => {
    if (Object.keys(room.players || {}).length === 0 && myPlayerName) {
      if (newPlayerName === "") {
        setNewPlayerName(myPlayerName);
      }
    }
  }, [room.players])

  const removePlayer = async (playerName: string) => {

    if (playerName === myPlayerName) {
      setMyPlayerName(myPlayerName);
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

  const addNewPlayer = () => {
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

      setNewPlayerName('');
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
    <div>
      <h2>Players in the game:</h2>
      {playersInGame.map(playerName => (
        <div key={playerName}>
          {playerName}
          <button onClick={() => removePlayer(playerName)}>
            Remove
          </button>
          {playerName === myPlayerName && <span> (You)</span>}
        </div>
      ))}
      
      {playersInGame.length === 0 && (
        <em>None yet, please join.</em>
      )}

      {!playersInGame.includes(myPlayerName || '') && (
        <div>
          <input
            type="text"
            value={newPlayerName}
            onChange={(e) => setNewPlayerName(e.target.value)}
            placeholder="Enter your name"
          />
          <button onClick={addNewPlayer}>
            Join Game
          </button>
        </div>
      )}
      <button onClick={beginGame} disabled={Object.keys(room.players || {}).length < 1}>
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
}

export default App