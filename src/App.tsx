import './App.css'
import { init, tx, id } from '@instantdb/react'
import Board from './Board'
import { APP_ID, Schema, Player, Room } from './Types'
import { useState, useEffect } from 'react'

const db = init<Schema>({ appId: APP_ID })

function App() {
  const [roomName, setRoomName] = useState('default')
  const [myPlayerId, setMyPlayerId] = useState<string | null>(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const roomParam = params.get('room')
    if (roomParam) setRoomName(roomParam)

    const storedPlayerId = localStorage.getItem('shamrockPlayerId')
    if (storedPlayerId) setMyPlayerId(storedPlayerId)
  }, [])

  const { isLoading, error, data } = db.useQuery({ 
    room: {$: {where: {name: roomName}}, joinedPlayers: {}},
    player: {}
  })

  if (isLoading) return <div>Fetching data...</div>
  if (error) return <div>Error fetching data: {error.message}</div>

  const { room, player } = data
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
            allPlayers={player} 
            myPlayerId={myPlayerId} 
            setMyPlayerId={setMyPlayerId} 
          />
        ) : (
          <Board roomId={currentRoom.id} playerId={myPlayerId!} />
        )}
      </div>
    </div>
  )
}

function GatheringPhase({ room, allPlayers, myPlayerId, setMyPlayerId }: 
  { room: Room, allPlayers: Player[], myPlayerId: string | null, setMyPlayerId: (id: string) => void }) {
  const togglePlayerInRoom = async (player: Player) => {
    const isInRoom = room.joinedPlayers.some(p => p.id === player.id)
    console.log("TOGGLE", isInRoom, player.id, room.id, room.joinedPlayers)
    if (isInRoom) {
      // await db.transact([
      // tx.room[room.id].unlink({ joinedPlayers: player.id })
      // ]);
    } else {
      await db.transact([
      tx.room[room.id].link({ joinedPlayers: player.id })
      ])
    }
  }

  const beginGame = () => {
    db.transact([
    tx.room[room.id].merge({ status: 'cluing', guessingViewState: { boardRotation: 0 } }),
     ...room.joinedPlayers.map(player => {
      const tiles = drawTiles()
      return tx.player[player.id].merge({
        tilesAsClued: tiles.slice(0, 4).map(rotateArray),
        tilesAsGuessed: shuffleArray(tiles.map(rotateArray))
      })
    })
  ])
  }

  const playersInGame = allPlayers.filter(player => 
    room.joinedPlayers.some(p => p.id === player.id)
  );
  const playersNotInGame = allPlayers.filter(player => 
    !room.joinedPlayers.some(p => p.id === player.id)
  );

  const addNewPlayer = () => {
    const newPlayerName = prompt("Enter new player name:")
    if (newPlayerName) {
      db.transact([
        tx.player[id()].update({ name: newPlayerName })
      ])
    }
  }

  const claimPlayer = (playerId: string) => {
    setMyPlayerId(playerId)
    localStorage.setItem('shamrockPlayerId', playerId)
  }

  return (
    <div>
      <h2>Players in the game:</h2>
      {playersInGame.map(player => (
        <div key={player.id}>
          {player.name}
          <button onClick={() => togglePlayerInRoom(player)}>
            Remove
          </button>
          {player.id !== myPlayerId && (
            <button onClick={() => claimPlayer(player.id)}>
              Me
            </button>
          )}
        </div>
      ))}
      
      <h2>Players not in the game:</h2>
      {playersNotInGame.map(player => (
        <div key={player.id}>
          {player.name}
          <button onClick={() => togglePlayerInRoom(player)}>
            Add
          </button>
          {player.id !== myPlayerId && (
            <button onClick={() => claimPlayer(player.id)}>
              Me
            </button>
          )}
        </div>
      ))}
      
      <button onClick={addNewPlayer}>
        New Player
      </button>
      
      <button onClick={beginGame} disabled={room.joinedPlayers.length < 2}>
        Begin Game
      </button>
    </div>
  )
}

function drawTiles(): string[][] {
  return Array(5).fill(0).map(() => ['A', 'B', 'C', 'D'])
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