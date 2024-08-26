import { useState, useEffect, useCallback } from 'react';
import BoardDisplay from './BoardDisplay';
import { APP_ID, Schema } from './Types';
import { init, tx } from '@instantdb/react';
import { throttle } from 'lodash';

const db = init<Schema>({ appId: APP_ID });

interface TileData {
  x: number;
  y: number;
  rotation: number;
  words: string[];
}

interface BoardProps {
  roomId: string;
  playerId: string;
}

const Board: React.FC<BoardProps> = ({ roomId, playerId }) => {
  const [gameState, setGameState] = useState<{tiles: TileData[], boardRotation: number}>({
    tiles: [],
    boardRotation: 0,
  });

  const [edgeInputs, setEdgeInputs] = useState<string[]>(['North', 'East', 'South', 'West']);

  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);
  useEffect(() => {
    setSelectedPlayer(playerId);
  }, [playerId]);

  const boardCenter = { x: 500, y: 500 };
  const boardRadius = 450;

  const { isLoading, error, data } = db.useQuery({
    room: { 
        $: {where: {id: roomId}},
        currentPlayer: { },
        joinedPlayers: {}
    }
  });

  useEffect(() => {
    if (!isLoading && !error && data.room) {
      const room = data.room[0];
      if (!room) return;

      if (room.currentPlayer?.[0]?.id) {
        setSelectedPlayer(room.currentPlayer[0].id);
      }

      const isCluing = room.status === 'cluing';
      const thisPlayer = room.joinedPlayers.find(p => p.id === playerId);
      const tilesData = isCluing ? thisPlayer?.tilesAsClued : thisPlayer?.tilesAsGuessed;
      
      if (tilesData && Array.isArray(tilesData)) {
        const newTiles: TileData[] = tilesData.map((words, index) => {
          if (isCluing) {
            // Initialize tiles in four quadrants for cluing phase
            const quadrant = index % 4;
            const x = boardCenter.x + (quadrant % 2 === 0 ? -1 : 1) * boardRadius / 2;
            const y = boardCenter.y + (quadrant < 2 ? -1 : 1) * boardRadius / 2;
            return { x, y, rotation: 0, words: words || [] };
          } else {
            // Use guessingViewState or initialize below the board for guessing phase
            const existingTile = room.guessingViewState?.tiles?.[index];
            if (existingTile) {
              return {
                x: existingTile.x || 0,
                y: existingTile.y || 0,
                rotation: existingTile.rotation || 0,
                words: words || []
              };
            } else {
              return {
                x: 1000/3/2 + (index % 3) * 1000/3,
                y: boardCenter.y + boardRadius * 1.6 + Math.floor(index / 3) * (1000/3 + 10),
                rotation: 0,
                words: words || []
              };
            }
          }
        });

        setGameState(prevState => ({
          ...prevState,
          tiles: newTiles.map(t => (isCluing ? {...t, rotation: prevState.boardRotation || 0} : t)),
          boardRotation:  isCluing ? prevState.boardRotation :  room.guessingViewState?.boardRotation || 0
        }));
      }
    }
  }, [isLoading, error, data]);

  const notifyServer = useCallback(throttle((newTiles: TileData[], newBoardRotation: number) => {
    console.log("notifyServer", data?.room[0].status)
    if (data?.room[0].status !== 'guessing') {
        return;
    }
    db.transact(
      tx.room[roomId].merge({
        guessingViewState: {
          tiles: newTiles,
          boardRotation: newBoardRotation
        }
      })
    );
  }, 500), [roomId]); // 200ms delay, which means max 5 times per second

  const handleBoardRotate = (): void => {
    setGameState(prevState => {
      const newRotation = prevState.boardRotation + Math.PI / 2;
      const newTiles = prevState.tiles.map(tile => {
        const dx = tile.x - boardCenter.x;
        const dy = tile.y - boardCenter.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance <= boardRadius) {
          const currentAngle = Math.atan2(dy, dx);
          const newAngle = currentAngle + Math.PI / 2;
          return {
            ...tile,
            x: boardCenter.x + distance * Math.cos(newAngle),
            y: boardCenter.y + distance * Math.sin(newAngle),
            rotation: tile.rotation + Math.PI / 2,
          };
        }
        return tile;
      });

      notifyServer(newTiles, newRotation);
      return {
        tiles: newTiles,
        boardRotation: newRotation,
      };
    });
  };

  const handleTileMove = (newTiles: TileData[]) => {
    if (data.room[0].status === 'cluing') return; // Ignore in cluing phase
    setGameState(prevState => {
      return {
        ...prevState,
        tiles: newTiles
      };
    });
    notifyServer(newTiles, gameState.boardRotation);
  };

  const handleTileRotate = (index: number) => {
    if (data.room[0].status === 'cluing') return; // Ignore in cluing phase
    setGameState(prevState => {
      const newTiles = [...prevState.tiles];
      newTiles[index] = {
        ...newTiles[index],
        rotation: newTiles[index].rotation + Math.PI / 2
      };
      notifyServer(newTiles, prevState.boardRotation);
      return {
        ...prevState,
        tiles: newTiles
      };
    });
  };

  const handleEdgeInputChange = (index: number, value: string) => {
    if (data.room[0].status === 'guessing') return;
    setEdgeInputs(prev => {
      const newInputs = [...prev];
      newInputs[index] = value;
      return newInputs;
    });
    // Unset readyToGuess when input changes
    
    db.transact([tx.player[playerId].merge({ readyToGuess: false })]);
  };

  const handleReadyClick = () => {
    db.transact([tx.player[playerId].merge({ readyToGuess: true })]);
  };

  const handleProceedToGuessing = () => {
    db.transact(tx.room[roomId].merge({ status: 'guessing' }));
  };

  const handlePlayerSelect = (playerId: string) => {
    if (!playerId) return; 
    setSelectedPlayer(playerId);
    db.transact([
        tx.room[roomId].link({ currentPlayer: playerId })
    ]);
  };

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  const room = data.room[0];
  const isCluing = room.status === 'cluing';
  const allPlayersReady = room.joinedPlayers.every(player => player.readyToGuess);

//   useEffect(() => {
//     if (currentPlayerId) {
//       setSelectedPlayer(currentPlayerId);
//     }
//   }, [currentPlayerId]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <div style={{ flex: 1, overflow: 'hidden' }}>
        {(selectedPlayer || isCluing) && (
          <BoardDisplay 
            tiles={gameState.tiles}
            boardRotation={gameState.boardRotation}
            edgeInputs={edgeInputs}
            onTileMove={handleTileMove}
            onTileRotate={handleTileRotate}
            onEdgeInputChange={handleEdgeInputChange}
            onBoardRotate={handleBoardRotate}
          />
        )}
      </div>
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        gap: '10px',
        padding: '10px',
        backgroundColor: '#f0f0f0',
        borderTop: '1px solid #ccc'
      }}>
        {!isCluing && (
          <select 
            value={selectedPlayer || ''} 
            onChange={(e) => handlePlayerSelect(e.target.value)}
            style={{
              padding: '10px 20px',
              fontSize: '16px',
              backgroundColor: '#ffffff',
              color: '#333',
              border: '1px solid #ccc',
              borderRadius: '5px',
              cursor: 'pointer',
              appearance: 'none',
              WebkitAppearance: 'none',
              MozAppearance: 'none',
              backgroundImage: 'url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23007CB2%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E")',
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'right 10px top 50%',
              backgroundSize: '12px auto',
              minWidth: '200px'
            }}
          >
            <option value="">Select a player</option>
            {room.joinedPlayers.map(player => (
              <option key={player.id} value={player.id}>{player.name}</option>
            ))}
          </select>
        )}
        {isCluing && (
          <>
            <button 
              disabled={data.room[0].joinedPlayers.find(p => p.id === playerId)?.readyToGuess}
              onClick={handleReadyClick}
              style={{
                padding: '10px 20px',
                fontSize: '16px',
                backgroundColor: data.room[0].joinedPlayers.find(p => p.id === playerId)?.readyToGuess ? '#ccc' : '#4CAF50',
                color: 'white',
                border: 'none',
                borderRadius: '5px',
                cursor: 'pointer'
              }}
            >
              I'm&nbsp;Ready
            </button>
            {allPlayersReady && (
              <button 
                onClick={handleProceedToGuessing}
                style={{
                  padding: '10px 20px',
                  fontSize: '16px',
                  backgroundColor: '#2196F3',
                  color: 'white',
                  border: 'none',
                  borderRadius: '5px',
                  cursor: 'pointer'
                }}
              >
                Proceed to Guessing
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default Board;