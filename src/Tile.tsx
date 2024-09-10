import React from 'react';

interface TileProps {
  x: number;
  y: number;
  rotation: number;
  size: number;
  words: string[];
  isOnBoard: boolean;
  draggingUser?: string;
}

const Tile: React.FC<TileProps> = ({ x, y, rotation, size, words, isOnBoard, draggingUser }) => {
  const fontSize = size * 0.12; // Slightly reduced font size
  const padding = size * 0.11; // Reduced padding

  return (
    <g transform={`translate(${x}, ${y}) rotate(${rotation * 180 / Math.PI})`}>
      <rect
        x={-size / 2}
        y={-size / 2}
        width={size}
        height={size}
        fill={isOnBoard ? 'green' : 'red'}
        stroke="white"
        strokeWidth="2"
      />
      {words.map((word, index) => {
        let textX: number, textY: number, rotate: number;
        switch(index) {
          case 0: textX = 0; textY = -size / 2 + padding * .5 ; rotate = 0; break; // Increased top padding
          case 1: textX = size / 2 - padding; textY = 0; rotate = 90; break;
          case 2: textX = 0; textY = size / 2 - padding * 1.5; rotate = 180; break; // Decreased bottom padding
          case 3: textX = -size / 2 + padding; textY = 0; rotate = 270; break;
          default: textX = 0; textY = 0; rotate = 0;
        }
        return (
          <>
            <text
              key={index}
              x={textX}
              y={textY}
              fontSize={fontSize}
              fill="white"
              textAnchor="middle"
              dominantBaseline={index === 0 ? "hanging" : index === 2 ? "auto" : "middle"}
              transform={`rotate(${rotate}, ${textX}, ${textY})`}
            >
              {word}
            </text>
            
          </>
        );
      })}

      {draggingUser && (
        <text
          x={0}
          y={size / 2 + fontSize}
          fontSize={fontSize * 0.8}
          fill="black"
          textAnchor="middle"
          dominantBaseline="hanging"
          transform={`rotate(${-rotation * 180 / Math.PI})`}
        >
          {draggingUser}
        </text>
      )}
    </g>
  );
};

export default Tile;