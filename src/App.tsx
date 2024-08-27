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
    </div>
  )
}

function GatheringPhase({ room, myPlayerName, setMyPlayerName }: 
  { room: Room, myPlayerName: string | null, setMyPlayerName: (name: string) => void }) {
  const [newPlayerName, setNewPlayerName] = useState('');

  const removePlayer = async (playerName: string) => {

    if (playerName === myPlayerName) {
      setMyPlayerName('myPlayerName');
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
          players: {...addNew, ...removeOld}
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
      
      <h2>Add new player:</h2>
      <input
        type="text"
        value={newPlayerName}
        onChange={(e) => setNewPlayerName(e.target.value)}
        placeholder="Enter player name"
      />
      <button onClick={addNewPlayer}>
        Add Player
      </button>
      
      <button onClick={beginGame} disabled={Object.keys(room.players || {}).length < 2}>
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
    height: '100vh',
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
    overflow: 'hidden',
    width: 'min(100vw, 50vh)',
    height: 'min(200vw, 100vh)',
    maxWidth: '100%',
    maxHeight: '100%',

  },
  form: {
    boxSizing: 'inherit',
    display: 'flex',
    border: '1px solid lightgray',
    borderBottomWidth: '0px',
    width: '350px',
  },
  toggleAll: {
    fontSize: '30px',
    cursor: 'pointer',
    marginLeft: '11px',
    marginTop: '-6px',
    width: '15px',
    marginRight: '12px',
  },
  input: {
    backgroundColor: 'transparent',
    fontFamily: 'code, monospace',
    width: '287px',
    padding: '10px',
    fontStyle: 'italic',
  },
  todoList: {
    boxSizing: 'inherit',
    width: '350px',
  },
  checkbox: {
    fontSize: '30px',
    marginLeft: '5px',
    marginRight: '20px',
    cursor: 'pointer',
  },
  todo: {
    display: 'flex',
    alignItems: 'center',
    padding: '10px',
    border: '1px solid lightgray',
    borderBottomWidth: '0px',
  },
  todoText: {
    flexGrow: '1',
    overflow: 'hidden',
  },
  delete: {
    width: '25px',
    cursor: 'pointer',
    color: 'lightgray',
  },
  actionBar: {
    display: 'flex',
    justifyContent: 'space-between',
    width: '328px',
    padding: '10px',
    border: '1px solid lightgray',
    fontSize: '10px',
  },
  footer: {
    marginTop: '20px',
    fontSize: '10px',
  },
}

export default App