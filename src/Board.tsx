import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import BoardDisplay from './BoardDisplay';
import { APP_ID, Schema, Room, PlayerData } from './Types';
import { init, tx } from '@instantdb/react';
import { debounce, isEqual } from 'lodash';

const db = init<Schema>({ appId: APP_ID });

interface TileData {
  x: number;
  y: number;
  rotation: number;
  words: string[];
}

interface BoardProps {
  roomId: string;
  playerName: string;
  data: any;
}

const Board: React.FC<BoardProps> = ({ roomId, playerName, data }) => {
  const [gameState, setGameState] = useState<{tiles: TileData[], boardRotation: number}>({
    tiles: [],
    boardRotation: 0,
  });

  const [edgeInputs, setEdgeInputs] = useState<string[]>(["","","",""]);

  const boardCenter = { x: 500, y: 540 };
  const boardRadius = 450;

  useEffect(() => {
    if (edgeInputs.join("").length === 0) {
        setEdgeInputs(data?.room?.[0].players[playerName]?.clues || ["","","",""])
    }
  }, [data?.room?.[0]?.players?.[playerName]?.clues])

  const synedOnStart = useRef(false);

  useEffect(() => {
    if (data.room) {
      const room = data.room[0];
      if (!room) return;

      const isCluing = room.status === 'cluing';
      const thisPlayer = room.players[playerName];
      const tilesData = isCluing ? thisPlayer?.tilesAsClued : room.guessingViewState?.tiles?.map(t =>t.words);
     
      if (tilesData && Array.isArray(tilesData)) {

        if (isCluing) {
            if (synedOnStart.current) {
                return;
            }
            synedOnStart.current = true;
        }
    
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
            console.log("EXISTING TILE", existingTile)
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

        if (!isCluing) {
            setEdgeInputs(room.players[room.guessingViewState?.playerName ]?.clues)
        }
        setGameState(prevState => ({
          tiles: newTiles,
          boardRotation: isCluing ? prevState.boardRotation : room.guessingViewState?.boardRotation || 0
        }));
      }
    }
  }, [data, playerName]);

  const notifyServer = useCallback((newTiles: TileData[], newBoardRotation: number) => {
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
  }, [roomId, data]);

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

  const handleTileMove = (newTiles: TileData[], boardRotation: number) => {
    if (data?.room[0].status === 'cluing') return;
    notifyServer(newTiles, boardRotation);
  };

  const handleTileRotate = (index: number) => {
    if (data?.room[0].status === 'cluing') return;
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
    db.transact([
      tx.room[roomId].merge({
        players: {
          [playerName]: {
            readyToGuess: false
          }
        }
      })
    ]);
  };

  const handleReadyClick = () => {
    db.transact([
      tx.room[roomId].merge({
        players: {
          [playerName]: {
            readyToGuess: true,
            clues: edgeInputs
          }
        }
      })
    ]);
  };

  const handleProceedToGuessing = () => {
    db.transact(tx.room[roomId].merge({ status: 'guessing' }));
  };

  const handlePlayerSelect = (selectedPlayerName: string) => {
    const selectedPlayer = data.room[0].players[selectedPlayerName];
    console.log("SELECTED PLAYER", selectedPlayer)
    if (selectedPlayer) {

      const newTiles = selectedPlayer.tilesAsGuessed.map((words, index) => ({
        x: 1000/3/2 + (index % 3) * 1000/3,
        y: boardCenter.y + boardRadius * 1.6 + Math.floor(index / 3) * (1000/3 + 10),
        rotation: 0,
        words: words || []
      }));
      console.log("NEW TILES", newTiles)

      db.transact(
        tx.room[roomId].merge({
          guessingViewState: {
            playerName: selectedPlayerName,
            tiles: newTiles,
            boardRotation: 0
          }
        })
      );
    }
  };

  const room = data?.room?.[0];
  console.log("DATA inside", data)
  if (!room) return <div>Loading...</div>;

  const isCluing = room.status === 'cluing';
  console.log("ROOM", room, isCluing    )
  const allPlayersReady = Object.values(room.players).every(player => player.readyToGuess);

  const prevPropsRef = useRef({ tiles: gameState.tiles, boardRotation: gameState.boardRotation, edgeInputs });

  const shouldUpdateBoardDisplay = useMemo(() => {
    const prevProps = prevPropsRef.current;
    const shouldUpdate = !isEqual(prevProps.tiles, gameState.tiles) ||
      prevProps.boardRotation !== gameState.boardRotation ||
      !isEqual(prevProps.edgeInputs, edgeInputs);

    if (shouldUpdate) {
        console.log("SHOULD UPDATE", "Because",
            !isEqual(prevProps.tiles, gameState.tiles),
            prevProps.boardRotation !== gameState.boardRotation,
            !isEqual(prevProps.edgeInputs, edgeInputs)
        )
      prevPropsRef.current = {
        tiles: gameState.tiles,
        boardRotation: gameState.boardRotation,
        edgeInputs
      };
    }

    return shouldUpdate;
  }, [gameState.tiles, gameState.boardRotation, edgeInputs]);

  const memoizedBoardDisplay = useMemo(() => {
    if (!shouldUpdateBoardDisplay ) {
      return prevPropsRef.current.component;
    }

    const newComponent = (
      <BoardDisplay 
        tiles={gameState.tiles}
        boardRotation={gameState.boardRotation}
        edgeInputs={edgeInputs}
        onTileMove={handleTileMove}
        onTileRotate={handleTileRotate}
        onEdgeInputChange={handleEdgeInputChange}
        onBoardRotate={handleBoardRotate}
      />
    );

    prevPropsRef.current.component = newComponent;
    return newComponent;
  }, [shouldUpdateBoardDisplay, gameState.tiles, gameState.boardRotation, edgeInputs, handleTileMove, handleTileRotate, handleEdgeInputChange, handleBoardRotate]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <div style={{ flex: 1, overflow: 'hidden' }}>
        {memoizedBoardDisplay}
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
        {isCluing && (
          <>
            <button 
              disabled={room.players[playerName]?.readyToGuess}
              onClick={handleReadyClick}
              style={{
                padding: '10px 20px',
                fontSize: '16px',
                backgroundColor: room.players[playerName]?.readyToGuess ? '#ccc' : '#4CAF50',
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
        {!isCluing && (
          <select
            onChange={(e) => handlePlayerSelect(e.target.value)}
            value={data.room[0].guessingViewState?.playerName || ''}
            style={{
              padding: '10px',
              fontSize: '16px',
              borderRadius: '5px',
              border: '1px solid #ccc'
            }}
          >
            <option value="">Select a player</option>
            {Object.keys(data.room[0].players).map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
        )}
      </div>
    </div>
  );
};

export default Board;