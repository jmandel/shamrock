import React, { useRef, useState, useEffect, useMemo } from 'react';
import Tile from './Tile';
import { Room } from './Types';

type TileData = Room['guessingViewState']['tiles'][number]

interface BoardDisplayProps {
  tiles: TileData[];
  boardRotation: number;
  edgeInputs: string[];
  status: Room['status'];
  onTileMove: (movedTileIndex: number, newTiles: TileData[], boardRotation: number) => void;
  onTileRelease: (newTiles: TileData[], boardRotation: number) => void;
  onTileRotate: (index: number) => void;
  onEdgeInputChange: (index: number, value: string) => void;
  onBoardRotate: () => void;
}

const BoardDisplay: React.FC<BoardDisplayProps> = ({
  tiles,
  boardRotation,
  edgeInputs,
  status,
  onTileMove,
  onTileRelease,
  onTileRotate,
  onEdgeInputChange,
  onBoardRotate
}) => {
  const [currentState, setCurrentState] = useState<{tiles: TileData[], boardRotation: number}>({
    tiles,
    boardRotation
  });
  const prevTargetRef = useRef<{tiles: TileData[], boardRotation: number}>({ tiles, boardRotation });
  const isAnimatingRef = useRef<boolean>(false);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [draggingTile, setDraggingTile] = useState<{index: number, startX: number, startY: number, offsetX: number, offsetY: number} | null>(null);
  const tapTimeoutRef = useRef<number | null>(null);
  const animationIdRef = useRef<number | null>(null);

  const viewBoxWidth = 1000;
  const viewBoxHeight = 2000;
  const boardRadius = viewBoxWidth / 2 - 80;
  const topPadding = 120;
  const boardCenter = { x: viewBoxWidth / 2, y: boardRadius + topPadding };

  // Calculate tile size based on number of tiles
  const numTiles = tiles.length;
  const numCols = numTiles <= 6 ? 3 : 4;
  const tileSize = (viewBoxWidth / numCols) - 20; // Add some padding between tiles

  const totalFrames = 10;
  const inputHeight = 100;

  const isOnBoard = (x: number, y: number): boolean => {
    const dx = x - boardCenter.x;
    const dy = y - boardCenter.y;
    return Math.sqrt(dx * dx + dy * dy) <= boardRadius;
  };

  const updateStateWithoutAnimation = (newTiles: TileData[], newBoardRotation: number): void => {
    setCurrentState({
      tiles: newTiles,
      boardRotation: newBoardRotation
    });
    prevTargetRef.current = { tiles: newTiles, boardRotation: newBoardRotation };
  };

  useEffect(() => {
    if (animationIdRef.current) {
      cancelAnimationFrame(animationIdRef.current);
      animationIdRef.current = null;
    }
    
    // Check if the number of tiles has changed (like after a redeal)
    const tileCountChanged = tiles.length !== prevTargetRef.current.tiles.length;
    
    // If tile count changed, immediately update without animation
    if (tileCountChanged) {
      isAnimatingRef.current = false;
      updateStateWithoutAnimation(tiles, boardRotation);
      return;
    }

    const rotationChanged = boardRotation !== prevTargetRef.current.boardRotation;
    const tilesChanged = JSON.stringify(tiles) !== JSON.stringify(prevTargetRef.current.tiles);
    const onlyPositionsChanged = tilesChanged && !rotationChanged && 
      tiles.every((tile, index) => 
        prevTargetRef.current.tiles[index] && 
        tile.rotation === prevTargetRef.current.tiles[index].rotation);

    if (rotationChanged || (tilesChanged && !onlyPositionsChanged)) {
      isAnimatingRef.current = true;
      animateRotation(0);
    } else {
      isAnimatingRef.current = false;
      updateStateWithoutAnimation(tiles, boardRotation);
    }

    return () => {
      if (animationIdRef.current) {
        cancelAnimationFrame(animationIdRef.current);
      }
    };
  }, [tiles, boardRotation]);

  const normalizeAngle = (angle: number): number => {
    return angle - Math.floor(angle / (2 * Math.PI)) * 2 * Math.PI;
  };

  // We're keeping the regular normalizeAngle but not adding the normalizeAngleToRightAngle
  // function here as that's part of the state normalization done in Board.tsx

  const clockwiseAngleBetween = (start: number, end: number): number => {
    start = normalizeAngle(start);
    end = normalizeAngle(end);
    return (end - start + 2 * Math.PI) % (2 * Math.PI);
  };

  const animateRotation = (frame: number): void => {
    if (frame <= totalFrames) {
      const progress = frame / totalFrames;
      
      // Ensure the target rotation is normalized to a right angle
      const rotationDiff = clockwiseAngleBetween(prevTargetRef.current.boardRotation, boardRotation);
      const newRotation = prevTargetRef.current.boardRotation + rotationDiff * progress;

      const newTiles = currentState.tiles.map((tile, index) => {
        // Safely access previous and target tiles
        const prevTile = prevTargetRef.current.tiles[index] || tile;
        const targetTile = tiles[index] || tile;
        
        // Only calculate rotation diff if both tiles exist
        const rotationDiff = prevTile && targetTile 
          ? clockwiseAngleBetween(prevTile.rotation, targetTile.rotation)
          : 0;
          
        const newTile = {
          ...tile,
          rotation: prevTile ? prevTile.rotation + rotationDiff * progress : tile.rotation,
        };

        if (prevTile && targetTile && isOnBoard(prevTile.x, prevTile.y)) {
          const startAngle = Math.atan2(prevTile.y - boardCenter.y, prevTile.x - boardCenter.x);
          const endAngle = Math.atan2(targetTile.y - boardCenter.y, targetTile.x - boardCenter.x);
          const angleDiff = clockwiseAngleBetween(startAngle, endAngle);
          const currentAngle = startAngle + angleDiff * progress;
          const distance = Math.sqrt(Math.pow(targetTile.x - boardCenter.x, 2) + Math.pow(targetTile.y - boardCenter.y, 2));

          newTile.x = boardCenter.x + distance * Math.cos(currentAngle);
          newTile.y = boardCenter.y + distance * Math.sin(currentAngle);
        } else if (prevTile && targetTile) {
          newTile.x = prevTile.x + (targetTile.x - prevTile.x) * progress;
          newTile.y = prevTile.y + (targetTile.y - prevTile.y) * progress;
        }

        return newTile;
      });

      setCurrentState({
        tiles: newTiles,
        boardRotation: newRotation
      });

      animationIdRef.current = requestAnimationFrame(() => animateRotation(frame + 1));
    } else {
      updateStateWithoutAnimation(tiles, boardRotation);
      isAnimatingRef.current = false;
      animationIdRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      if (animationIdRef.current) {
        cancelAnimationFrame(animationIdRef.current);
      }
    };
  }, []);

  const getSVGCoordinates = (event: React.PointerEvent | React.TouchEvent): {x: number, y: number} => {
    const svg = svgRef.current;
    if (!svg) return {x: 0, y: 0};
    const point = svg.createSVGPoint();
    if ('clientX' in event) {
      point.x = event.clientX;
      point.y = event.clientY;
    } else {
      point.x = event.touches[0].clientX;
      point.y = event.touches[0].clientY;
    }
    return point.matrixTransform(svg.getScreenCTM()?.inverse());
  };

  const handlePointerDown = (event: React.PointerEvent, index: number): void => {
    event.preventDefault();
    const coords = getSVGCoordinates(event);
    setDraggingTile({ index, startX: coords.x, startY: coords.y, offsetX: currentState.tiles[index].x - coords.x, offsetY: currentState.tiles[index].y - coords.y });
    tapTimeoutRef.current = window.setTimeout(() => {
      tapTimeoutRef.current = null;
    }, 300);
  };

  const handlePointerMove = (event: React.PointerEvent): void => {
    event.preventDefault();
    if (draggingTile !== null) {
      const coords = getSVGCoordinates(event);
      
      if (tapTimeoutRef.current) {
        if ((Math.abs(coords.x - draggingTile.startX) > 10 || Math.abs(coords.y - draggingTile.startY) > 10)) {
          clearTimeout(tapTimeoutRef.current);
          tapTimeoutRef.current = null;
        } else {
          return;
        }
      }

      const newX = coords.x + draggingTile.offsetX;
      const newY = coords.y + draggingTile.offsetY;
      const newTiles = [...currentState.tiles];
      newTiles[draggingTile.index] = {
        ...newTiles[draggingTile.index],
        x: newX,
        y: newY
      };
      onTileMove(draggingTile.index, newTiles, currentState.boardRotation);
    }
  };

  const handlePointerUp = (event: React.PointerEvent): void => {
    event.preventDefault();
    // alert(`Up ${event.clientX} ${event.clientY} ${draggingTile?.index} ${tapTimeoutRef.current}`)
    if (tapTimeoutRef.current) {
      clearTimeout(tapTimeoutRef.current);
      onTileRotate(draggingTile.index);
    } else {
      onTileRelease(currentState.tiles, currentState.boardRotation);
    }
    setDraggingTile(null);
    tapTimeoutRef.current = null;
  };

  const handleBoardClick = (event: React.MouseEvent<SVGCircleElement>) => {
    // Check if the click is not on a tile
    if (event.target === event.currentTarget) {
      onBoardRotate();
    }
  };

  // This placeholder generation is replaced by the useMemo below

  // Generate placeholders safely, checking for valid tiles with words
  const placeholders = useMemo(() => {
    if (!tiles || tiles.length < 4 || !tiles.every(tile => tile && tile.words && tile.words.length >= 4)) {
      return ["", "", "", ""];
    }
    
    return [
      `${tiles[0].words[0]} & ${tiles[1].words[0]}`,
      `${tiles[1].words[1]} & ${tiles[3].words[1]}`,
      `${tiles[3].words[2]} & ${tiles[2].words[2]}`,
      `${tiles[2].words[3]} & ${tiles[0].words[3]}`
    ];
  }, [tiles])

  const sortedTiles = useMemo(() => {
    return [...currentState.tiles].sort((a, b) => {
      if (a.draggingUser && !b.draggingUser) return 1;
      if (!a.draggingUser && b.draggingUser) return -1;
      return 0;
    });
  }, [currentState.tiles]);

  return (
    <svg
      ref={svgRef}
      width="100%"
      height="100%"
      viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}
      preserveAspectRatio="xMidYMin meet"
      className="board-svg"
      style={{ touchAction: 'none' }}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      <g transform={`rotate(${currentState.boardRotation * 180 / Math.PI}, ${boardCenter.x}, ${boardCenter.y})`}>
        <circle
          cx={boardCenter.x}
          cy={boardCenter.y}
          r={boardRadius}
          className="board-circle"
          onClick={handleBoardClick}
          style={{ cursor: 'pointer' }}
        />
        {[
          { x: boardCenter.x - boardRadius, y: boardCenter.y - boardRadius - inputHeight, width: boardRadius * 2, height: inputHeight, index: 0 },
          { x: boardCenter.x + boardRadius, y: boardCenter.y - boardRadius, width: inputHeight, height: boardRadius * 2, index: 1 },
          { x: boardCenter.x - boardRadius, y: boardCenter.y + boardRadius, width: boardRadius * 2, height: inputHeight, index: 2 },
          { x: boardCenter.x - boardRadius - inputHeight, y: boardCenter.y - boardRadius, width: inputHeight, height: boardRadius * 2, index: 3 }
        ].map(({ x, y, width, height, index }) => (
          <foreignObject 
            key={index} 
            x={x} 
            y={y} 
            width={width} 
            height={height} 
            transform={index === 2 || index === 3 ? `rotate(180, ${x + width/2}, ${y + height/2})` : ''}
          >
            <div style={{ width: '100%', height: '100%' }}>
              <input
                className="board-input"
                value={edgeInputs[index]}
                placeholder={status === 'guessing' ? '' : placeholders[index]}
                disabled={status === 'guessing'}
                onChange={(e) => onEdgeInputChange(index, e.target.value)}
                style={{
                  userSelect: status === 'guessing' ? 'none' : 'auto',
                  width: '100%',
                  height: '100%',
                  textAlign: 'center',
                  fontSize: '5rem',
                  ...(index === 1 || index === 3 ? {
                    writingMode: 'vertical-rl',
                    textOrientation: 'mixed',
                  } : {}),
                  /* Transform is now handled at the foreignObject level */
                }}
              />
            </div>
          </foreignObject>
        ))}
      </g>

      {sortedTiles.map((tile, index) => (
        <g
          key={index}
          onPointerDown={(e) => handlePointerDown(e, currentState.tiles.indexOf(tile))}
          style={{ cursor: 'grab' }}
        >
          <Tile
            x={tile.x}
            y={tile.y}
            rotation={tile.rotation}
            size={tileSize}
            words={tile.words}
            draggingUser={tile.draggingUser}
            isOnBoard={isOnBoard(tile.x, tile.y)}
          />
        </g>
      ))}
    </svg>
  );
};

export default BoardDisplay;
