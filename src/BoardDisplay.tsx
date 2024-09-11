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

  const tileSize = viewBoxWidth / 3;
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

    const rotationChanged = boardRotation !== prevTargetRef.current.boardRotation;
    const tilesChanged = JSON.stringify(tiles) !== JSON.stringify(prevTargetRef.current.tiles);
    const onlyPositionsChanged = tilesChanged && !rotationChanged && 
      tiles.every((tile, index) => 
        tile.rotation === prevTargetRef.current.tiles[index]?.rotation);

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

  const clockwiseAngleBetween = (start: number, end: number): number => {
    start = normalizeAngle(start);
    end = normalizeAngle(end);
    return (end - start + 2 * Math.PI) % (2 * Math.PI);
  };

  const animateRotation = (frame: number): void => {
    if (frame <= totalFrames) {
      const progress = frame / totalFrames;
      const rotationDiff = clockwiseAngleBetween(prevTargetRef.current.boardRotation, boardRotation);
      const newRotation = prevTargetRef.current.boardRotation + rotationDiff * progress;

      const newTiles = currentState.tiles.map((tile, index) => {
        const prevTile = prevTargetRef.current.tiles[index];
        const targetTile = tiles[index];
        const rotationDiff = clockwiseAngleBetween(prevTile.rotation, targetTile.rotation);
        const newTile = {
          ...tile,
          rotation: prevTile.rotation + rotationDiff * progress,
        };

        if (isOnBoard(prevTile.x, prevTile.y)) {
          const startAngle = Math.atan2(prevTile.y - boardCenter.y, prevTile.x - boardCenter.x);
          const endAngle = Math.atan2(targetTile.y - boardCenter.y, targetTile.x - boardCenter.x);
          const angleDiff = clockwiseAngleBetween(startAngle, endAngle);
          const currentAngle = startAngle + angleDiff * progress;
          const distance = Math.sqrt(Math.pow(targetTile.x - boardCenter.x, 2) + Math.pow(targetTile.y - boardCenter.y, 2));
          console.log("2d", distance, Math.sqrt(Math.pow(prevTile.x - boardCenter.x, 2) + Math.pow(prevTile.y - boardCenter.y, 2)));

          newTile.x = boardCenter.x + distance * Math.cos(currentAngle);
          newTile.y = boardCenter.y + distance * Math.sin(currentAngle);
        } else {
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
    }, 200);
  };

  const handlePointerMove = (event: React.PointerEvent): void => {
    event.preventDefault();
    if (draggingTile !== null) {
      const coords = getSVGCoordinates(event);
      
      if (tapTimeoutRef.current && (Math.abs(coords.x - draggingTile.startX) > 5 || Math.abs(coords.y - draggingTile.startY) > 5)) {
        clearTimeout(tapTimeoutRef.current);
        tapTimeoutRef.current = null;
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

  const placeholders = tiles.length > 3 ? [
    `${tiles[0].words[0]} & ${tiles[1].words[0]}`,
    `${tiles[1].words[1]} & ${tiles[3].words[1]}`,
    `${tiles[3].words[2]} & ${tiles[2].words[2]}`,
    `${tiles[2].words[3]} & ${tiles[0].words[3]}`

  ] : []

  console.log("TILES", tiles)

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
      style={{ backgroundColor: 'white', touchAction: 'none' }}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
    >
      <g transform={`rotate(${currentState.boardRotation * 180 / Math.PI}, ${boardCenter.x}, ${boardCenter.y})`}>
        <circle
          cx={boardCenter.x}
          cy={boardCenter.y}
          r={boardRadius}
          fill="lightblue"
          onClick={handleBoardClick}
          style={{ cursor: 'pointer' }}
        />
        {[
          { x: boardCenter.x - boardRadius, y: boardCenter.y - boardRadius - inputHeight, width: boardRadius * 2, height: inputHeight, index: 0 },
          { x: boardCenter.x + boardRadius, y: boardCenter.y - boardRadius, width: inputHeight, height: boardRadius * 2, index: 1 },
          { x: boardCenter.x - boardRadius, y: boardCenter.y + boardRadius, width: boardRadius * 2, height: inputHeight, index: 2 },
          { x: boardCenter.x - boardRadius - inputHeight, y: boardCenter.y - boardRadius, width: inputHeight, height: boardRadius * 2, index: 3 }
        ].map(({ x, y, width, height, index }) => (
          <foreignObject key={index} x={x} y={y} width={width} height={height}>
            <div style={{ width: '100%', height: '100%' }}>
              <input
                value={edgeInputs[index]}
                placeholder={placeholders[index]}
                disabled={status === 'guessing'}
                onChange={(e) => onEdgeInputChange(index, e.target.value)}
                style={{
                  userSelect: status === 'guessing' ? 'none' : 'auto',
                  width: '100%',
                  height: '100%',
                  textAlign: 'center',
                  backgroundColor: '#f0f8ff', // Light sky blue color
                  border: '1px solid #d1d5db',
                  fontSize: '5rem',
                  ...(index === 1 || index === 3 ? {
                    writingMode: 'vertical-rl',
                    textOrientation: 'mixed',
                  } : {}),
                  ...(index === 2 || index === 3 ? {
                    transform: 'rotate(180deg)',
                  } : {})
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