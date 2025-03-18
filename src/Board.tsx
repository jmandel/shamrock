import { useCallback, useState, useEffect } from 'react';
import BoardDisplay from './BoardDisplay';
import { APP_ID, Room, Schema } from './Types';
import { init, tx } from '@instantdb/react';
import { shuffleArray, rotateArray } from './App';

const db = init<Schema>({ appId: APP_ID });

interface BoardProps {
  roomId: string;
  playerName: string;
  data: any;
  onPlayAgain: () => void;
  onResetRoom: () => void;
}

type TileData = Room['guessingViewState']['tiles'][number]

const Board: React.FC<BoardProps> = ({ roomId, playerName, data, onPlayAgain, onResetRoom }) => {
  const boardCenter = { x: 500, y: 540 };
  const boardRadius = 450;

  const room = data?.room?.[0] as Room;
  if (!room || !room.players) return <div>Loading...</div>;

  const isCluing = room.status === 'cluing';
  const allPlayersReady = Object.values(room.players).every(player => player.readyToGuess);
  
  // Get the fraction of ready players (0 to 1)
  const getReadyPlayerFraction = () => {
    const totalPlayers = Object.keys(room.players).length;
    const readyPlayers = Object.values(room.players).filter(player => player.readyToGuess).length;
    return totalPlayers > 0 ? readyPlayers / totalPlayers : 0;
  };
  
  // Helper function to normalize angle to right angle (multiple of PI/2)
  const normalizeToRightAngle = (angle: number): number => {
    return Math.round(angle / (Math.PI / 2)) * (Math.PI / 2);
  };

  const notifyServer = useCallback((newTiles: TileData[], newBoardRotation: number) => {
    if (room.status !== 'guessing') {
      return;
    }
    
    // Normalize tile rotations and board rotation before sending to server
    const normalizedRotation = normalizeToRightAngle(newBoardRotation);
    const normalizedTiles = newTiles.map(tile => ({
      ...tile,
      rotation: normalizeToRightAngle(tile.rotation)
    }));
    
    db.transact(
      tx.room[roomId].merge({
        guessingViewState: {
          playerName: room.guessingViewState?.playerName,
          tiles: normalizedTiles,
          boardRotation: normalizedRotation
        }
      })
    );
  }, [roomId, room.status, room.guessingViewState?.playerName]);

  // Add local state for cluing phase
  const [cluingBoardRotation, setCluingBoardRotation] = useState(0);
  const [cluingTiles, setCluingTiles] = useState<TileData[]>([]);
  
  const handleBoardRotate = (): void => {
    // Use local rotation state for cluing, server state for guessing
    const currentBoardRotation = isCluing ? cluingBoardRotation : (room.guessingViewState?.boardRotation || 0);
    const currentTiles = getCurrentTiles();
    
    // Normalize to ensure we're always at a multiple of PI/2 (90 degrees)
    const normalizedRotation = Math.round((currentBoardRotation + Math.PI / 2) / (Math.PI / 2)) * (Math.PI / 2);
    
    // Apply the normalized rotation to tiles
    const newTiles = currentTiles.map(tile => {
      const dx = tile.x - boardCenter.x;
      const dy = tile.y - boardCenter.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance <= boardRadius) {
        // Calculate new position using the normalized rotation
        const currentAngle = Math.atan2(dy, dx);
        const angleIncrement = normalizedRotation - currentBoardRotation;
        const newAngle = currentAngle + angleIncrement;
        
        // Also normalize tile rotation to keep it at right angles
        const normalizedTileRotation = Math.round((tile.rotation + angleIncrement) / (Math.PI / 2)) * (Math.PI / 2);
        
        return {
          ...tile,
          x: boardCenter.x + distance * Math.cos(newAngle),
          y: boardCenter.y + distance * Math.sin(newAngle),
          rotation: normalizedTileRotation,
        };
      }
      return tile;
    });

    if (isCluing) {
      // In cluing phase, just update local state (both rotation and tiles)
      setCluingBoardRotation(normalizedRotation);
      setCluingTiles(newTiles);
    } else {
      // In guessing phase, update the server
      db.transact(
        tx.room[roomId].merge({
          guessingViewState: {
            tiles: newTiles,
            boardRotation: normalizedRotation,
            playerName: room.guessingViewState?.playerName
          }
        })
      );
    }
  };

  // Initialize cluing tiles if needed or if they've changed (like after a redeal)
  useEffect(() => {
    if (isCluing) {
      const thisPlayer = room.players[playerName];
      const tilesData = thisPlayer?.tilesAsClued;
      
      // Create an ID based on tileDatas content to track when tiles change
      const tilesDataId = JSON.stringify(tilesData);
      
      // Initialize tiles in these scenarios:
      // 1. No tiles yet (first load)
      // 2. Player got new tiles (after redeal)
      const shouldInitializeTiles = 
        cluingTiles.length === 0 || 
        (tilesData && tilesData.length > 0 && 
         JSON.stringify(cluingTiles.map(t => t.words)) !== tilesDataId);
      
      if (shouldInitializeTiles && tilesData && Array.isArray(tilesData)) {
        // Initialize tiles in four quadrants
        const initialTiles = tilesData.map((words, index) => {
          const quadrant = index % 4;
          const x = boardCenter.x + (quadrant % 2 === 0 ? -1 : 1) * boardRadius / 2;
          const y = boardCenter.y + (quadrant < 2 ? -1 : 1) * boardRadius / 2;
          return { x, y, rotation: 0, words: words || [] };
        });
        
        setCluingTiles(initialTiles);
        setCluingBoardRotation(0); // Reset board rotation
      }
    }
  }, [isCluing, room.players, playerName, cluingTiles, boardCenter.x, boardCenter.y, boardRadius]);

  const getCurrentTiles = (): TileData[] => {
    // Common function to get current tiles based on game state
    if (isCluing) {
      // During cluing phase, use our local state tiles if available
      if (cluingTiles.length > 0) {
        return cluingTiles;
      }
      
      // Fallback to calculating from player data if local state isn't ready
      const thisPlayer = room.players[playerName];
      const tilesData = thisPlayer?.tilesAsClued;
      
      if (!tilesData || !Array.isArray(tilesData)) {
        return [];
      }
      
      // Initialize tiles in four quadrants for cluing phase
      return tilesData.map((words, index) => {
        const quadrant = index % 4;
        const x = boardCenter.x + (quadrant % 2 === 0 ? -1 : 1) * boardRadius / 2;
        const y = boardCenter.y + (quadrant < 2 ? -1 : 1) * boardRadius / 2;
        return { x, y, rotation: 0, words: words || [] };
      });
    } else {
      // For guessing phase
      if (!room.guessingViewState?.playerName) {
        return [];
      }
      
      const playerToShow = room.players[room.guessingViewState.playerName];
      
      // First check for existing tile positions in guessingViewState
      if (room.guessingViewState?.tiles && room.guessingViewState.tiles.length > 0) {
        // Get the words from tilesAsGuessed (which includes distractors)
        const guessWords = playerToShow?.tilesAsGuessed || [];
        
        // Use positions from guessingViewState but words from the tilesAsGuessed
        return room.guessingViewState.tiles.map((tile, index) => {
          return {
            ...tile,
            words: guessWords[index] || tile.words || []
          };
        });
      }
      
      // If no tiles in guessingViewState, use tilesAsGuessed (with distractors)
      const tilesData = playerToShow?.tilesAsGuessed;
      
      // If no tilesAsGuessed data is available, generate it on the fly
      if (!tilesData || !Array.isArray(tilesData) || tilesData.length === 0) {
        // If player has no tilesAsGuessed yet (unlikely at this point), use empty array
        return [];
      }
      
      // Create new positions for the tiles in a grid layout
      const numTiles = tilesData.length;
      const numCols = numTiles <= 6 ? 3 : 4;
      
      return tilesData.map((words, index) => {
        const colIndex = index % numCols;
        const rowIndex = Math.floor(index / numCols);
        const tileSpacing = 1000 / numCols;
        
        return {
          x: tileSpacing/2 + colIndex * tileSpacing,
          y: boardCenter.y + boardRadius * 1.6 + rowIndex * (tileSpacing + 10),
          rotation: 0,
          words: words || []
        };
      });
    }
  };

  const handleTileMove = (moveTileIndex: number, newTiles: TileData[], boardRotation: number) => {
    if (isCluing) return;
    
    const newTilesWithDraggingUser = newTiles.map((tile, index) => ({
      ...tile,
      draggingUser: moveTileIndex === index ? playerName : tile.draggingUser
    }));
    
    notifyServer(newTilesWithDraggingUser, boardRotation);
  };

  const handleTileRelease = (newTiles: TileData[], boardRotation: number) => {
    if (isCluing) return;
    
    const newTilesWithoutDraggingUser = newTiles.map((tile) => {
      if (tile.draggingUser === playerName) {
        return { ...tile, draggingUser: undefined };
      }
      return tile;
    });
    
    notifyServer(newTilesWithoutDraggingUser, boardRotation);
  };

  const handleTileRotate = (index: number) => {
    if (isCluing) return;
    
    const currentTiles = getCurrentTiles();
    if (!currentTiles[index]) return;
    
    const newTiles = [...currentTiles];
    const newRotation = newTiles[index].rotation + Math.PI / 2;
    
    newTiles[index] = {
      ...newTiles[index],
      draggingUser: undefined,
      rotation: newRotation
    };
    
    notifyServer(newTiles, room.guessingViewState?.boardRotation || 0);
  };

  const handleEdgeInputChange = (index: number, value: string) => {
    if (room.status === 'guessing') return;
    
    // Direct update to the database
    const currentClues = [...(room.players[playerName]?.clues || ["","","",""])];
    currentClues[index] = value;
    
    db.transact([
      tx.room[roomId].merge({
        players: {
          [playerName]: {
            readyToGuess: false,
            clues: currentClues
          }
        }
      })
    ]);
  };

  const generateGuessedTiles = (player: Room['players'][string], numDistractors: number) => {
    // Take specified number of distractor tiles from the pool
    const distractorTiles = shuffleArray([...player.tilesForDistractors]).slice(0, numDistractors);
    
    // Combine with the clued tiles
    const allTiles = [...player.tilesAsClued, ...distractorTiles];
    
    // Shuffle and randomize rotation of all tiles
    return shuffleArray(allTiles.map(rotateArray));
  };

  // handleReadyClick now accepts a numDistractors parameter directly
  const handleReadyClick = (numDistractors: number) => {
    const currentClues = [...(room.players[playerName]?.clues || ["","","",""])];
    const thisPlayer = room.players[playerName];
    
    // Generate the tiles with distractors for this player when they mark as ready
    // Use the provided numDistractors value directly, NOT from the database
    const tilesAsGuessed = generateGuessedTiles(thisPlayer, numDistractors);
    
    // Update both numDistractors and readyToGuess in a single transaction
    db.transact([
      tx.room[roomId].merge({
        players: {
          [playerName]: {
            numDistractors: numDistractors,
            readyToGuess: true,
            clues: currentClues,
            tilesAsGuessed: tilesAsGuessed
          }
        }
      })
    ]);
  };

  const handleProceedToGuessing = () => {
    db.transact(tx.room[roomId].merge({
      status: 'guessing',
      guessingViewState: {
        playerName: "", // Empty - no player selected
        tiles: [], // Empty tiles array
        boardRotation: 0
      }
    }));
  };

  const handlePlayerSelect = (selectedPlayerName: string) => {
    if (!selectedPlayerName) return; // Skip empty selections
    
    const selectedPlayer = room.players[selectedPlayerName];
    
    if (selectedPlayer) {
      // Use tilesAsGuessed which includes distractors
      const tilesData = selectedPlayer.tilesAsGuessed;
      
      // IMPORTANT: tilesAsGuessed should only be generated when a player clicks "Ready"
      if (!tilesData || !Array.isArray(tilesData) || tilesData.length === 0) {
        console.log(`Warning: ${selectedPlayerName} has no tilesAsGuessed - they need to click Ready first`);
        
        // Player hasn't clicked Ready yet, so set their name but don't display any tiles
        db.transact(tx.room[roomId].merge({
          guessingViewState: {
            playerName: selectedPlayerName,
            tiles: [], // Empty tiles since there's nothing to display yet
            boardRotation: 0
          }
        }));
      } else {
        // Use the existing tilesAsGuessed - never regenerate them here
        const numTiles = tilesData.length;
        const numCols = numTiles <= 6 ? 3 : 4;
        
        // Create new tiles arrangement for the selected player
        const newTiles = tilesData.map((words, index) => {
          const colIndex = index % numCols;
          const rowIndex = Math.floor(index / numCols);
          const tileSpacing = 1000 / numCols;
          
          return {
            x: tileSpacing/2 + colIndex * tileSpacing,
            y: boardCenter.y + boardRadius * 1.6 + rowIndex * (tileSpacing + 10),
            rotation: 0,
            words: words || []
          };
        });
        
        // Normalize tiles to ensure right-angle rotations
        const normalizedTiles = newTiles.map(tile => ({
          ...tile,
          rotation: normalizeToRightAngle(tile.rotation)
        }));
        
        // Update in a single transaction with a complete guessingViewState
        db.transact(tx.room[roomId].merge({
          guessingViewState: {
            playerName: selectedPlayerName,
            tiles: normalizedTiles,
            boardRotation: 0 // Starting rotation is already at a right angle
          }
        }));
      }
    }
  };
  
  // Get the current tiles and board state
  const currentTiles = getCurrentTiles();
  const currentBoardRotation = isCluing ? cluingBoardRotation : (room.guessingViewState?.boardRotation || 0);
  const currentEdgeInputs = isCluing 
    ? (room.players[playerName]?.clues || ["","","",""])
    : (room.guessingViewState?.playerName 
        ? (room.players[room.guessingViewState.playerName]?.clues || ["","","",""]) 
        : ["","","",""]);

  // Show a message when in guessing phase but no player is selected
  const showPlayerSelectionMessage = 
    room.status === 'guessing' && 
    (!room.guessingViewState?.playerName || room.guessingViewState.playerName === "");

  // Calculate deck statistics for display
  const calculateDeckStats = () => {
    if (!room.deckState) {
      return { used: 0, remaining: 0, total: 0 };
    }
    
    const totalTileSets = room.deckState.totalTiles;
    const usedTileSets = room.deckState.usedTileIndices.length;
    const remainingTileSets = totalTileSets - usedTileSets;
    
    return {
      used: usedTileSets,
      remaining: remainingTileSets,
      total: totalTileSets
    };
  };
  
  const deckStats = calculateDeckStats();
  return (
    <div style={{ display: 'flex', flexDirection: 'column',  height: '100%', width: 'min(100vw, 50dvh)' }}>
      <div style={{ flex: 1, maxHeight: 'calc(100dvh - 3.5em)', position: 'relative'}}>
        {/* Deck statistics indicator removed from here */}
        
        {showPlayerSelectionMessage ? (
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            textAlign: 'center',
            padding: '20px',
            background: 'rgba(0,0,0,0.5)',
            color: 'white',
            borderRadius: '8px',
            maxWidth: '80%'
          }}>
            <h3>Select a player to begin</h3>
            <p>Use the dropdown below to choose whose board to view</p>
          </div>
        ) : (
          <BoardDisplay 
            tiles={currentTiles}
            status={room.status}
            boardRotation={currentBoardRotation}
            edgeInputs={currentEdgeInputs}
            onTileMove={handleTileMove}
            onTileRelease={handleTileRelease}
            onTileRotate={handleTileRotate}
            onEdgeInputChange={handleEdgeInputChange}
            onBoardRotate={handleBoardRotate}
          />
        )}
      </div>
      <div className="board-controls" style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '8px',
        borderTop: '1px solid',
        height: '3.5em',
        overflow: 'hidden',
        whiteSpace: 'nowrap',
        gap: '12px',
        marginBottom: '120px'
      }}>
        {isCluing ? (
          <>
            {!room.players[playerName]?.readyToGuess && (
              <select
                onChange={(e) => {
                  if (e.target.value === 'not-ready') {
                    // Nothing to do, just showing options
                    return;
                  }
                  
                  // Parse the selected number of distractors
                  const count = parseInt(e.target.value);
                  
                  // Call handleReadyClick directly with the distractor count
                  // This ensures the count is used immediately without relying on database state
                  handleReadyClick(count);
                  
                  // Reset dropdown
                  e.target.value = 'not-ready';
                }}
                value="not-ready"
                style={{
                  padding: '4px 8px',
                  fontSize: '14px',
                  borderRadius: '4px',
                  backgroundColor: 'var(--ready-green)',
                  color: 'var(--text-on-dark)',
                  border: 'none',
                  cursor: 'pointer',
                  appearance: 'none',
                  WebkitAppearance: 'none',
                  MozAppearance: 'none',
                  backgroundImage: 'url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'white\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3e%3cpolyline points=\'6 9 12 15 18 9\'%3e%3c/polyline%3e%3c/svg%3e")',
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'right 4px center',
                  backgroundSize: '12px',
                  paddingRight: '24px',
                  flex: 1,
                  height: '32px'
                }}
              >
                <option value="not-ready">Ready...</option>
                {[1, 2, 3, 4].map(n => (
                  <option key={n} value={n}>with {n} {n === 1 ? 'distractor' : 'distractors'}</option>
                ))}
              </select>
            )}
            <div
              style={{
                position: 'relative',
                display: 'inline-block',
                flex: 1
              }}
            >
              <button 
                onClick={handleProceedToGuessing}
                disabled={!allPlayersReady}
                style={{
                  padding: '4px 12px',
                  fontSize: '14px',
                  backgroundColor: 'transparent', // Transparent background
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: allPlayersReady ? 'pointer' : 'not-allowed',
                  position: 'relative',
                  zIndex: 1, // Place text above the progress bar
                  height: '32px',
                  width: '100%' // Full width of parent
                }}
              >
                Proceed
              </button>
              {/* Background - always full width in gray */}
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                bottom: 0,
                width: '100%',
                backgroundColor: 'var(--background-gray)',
                borderRadius: '4px',
                zIndex: 0
              }}></div>
              {/* Progress fill - partial width based on ready players */}
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                bottom: 0,
                width: `${(getReadyPlayerFraction() * 100)}%`,
                backgroundColor: 'var(--action-blue)',
                borderRadius: '4px',
                transition: 'width 0.3s ease',
                zIndex: 0
              }}></div>
            </div>
          </>
        ) : null}
        
        {/* Action button with dropdown always visible at the end */}
        <div style={{ flex: isCluing ? 1 : '100%' }}>
          <select 
            style={{
              padding: '4px 8px',
              fontSize: '14px',
              borderRadius: '4px',
              backgroundColor: 'var(--ready-green)',
              color: 'var(--text-on-dark)',
              border: 'none',
              cursor: 'pointer',
              appearance: 'none',
              WebkitAppearance: 'none',
              MozAppearance: 'none',
              backgroundImage: 'url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'white\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3e%3cpolyline points=\'6 9 12 15 18 9\'%3e%3c/polyline%3e%3c/svg%3e")',
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'right 4px center',
              backgroundSize: '12px',
              paddingRight: '24px',
              minWidth: '140px', // Ensure it's wide enough for indented options
              height: '32px',
              width: '100%' // Make it fill the parent div
            }}
            onChange={(e) => {
              if (e.target.value === 'play-again') {
                onPlayAgain();
              } else if (e.target.value === 'reset') {
                onResetRoom();
              } else if (e.target.value.startsWith('player-')) {
                // Extract player name from the value (remove 'player-' prefix)
                const selectedPlayer = e.target.value.substring(7);
                handlePlayerSelect(selectedPlayer);
              }
              e.target.value = ''; // Reset select after action
            }}
            value=""
          >
            <option value="" disabled style={{ color: 'var(--dropdown-disabled)' }}>Actions</option>
            {!isCluing && (
              <>
                <option value="" disabled style={{ paddingLeft: '8px', fontWeight: 'bold', color: 'var(--dropdown-disabled)' }}>― Guess ―</option>
                {Object.keys(room.players).map((name) => (
                  <option key={name} value={`player-${name}`} style={{ paddingLeft: '16px' }}>
                    {name}{room.guessingViewState?.playerName === name ? ' ✓' : ''}
                  </option>
                ))}
                <option value="" disabled style={{ color: 'var(--dropdown-disabled)' }}>―――――</option>
              </>
            )}
            <option value="play-again">Re-deal{room.deckState ? ` (${deckStats.remaining}/${deckStats.total})` : ''}</option>
            <option value="reset">New Game</option>
          </select>
        </div>
      </div>
    </div>
  );
};

export default Board;
