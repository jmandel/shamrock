export type Schema = {
  room: Room
}

export type Room = {
  id: string,
  name: string,
  currentPlayerName: string,
  players: {
    [playerName: string]: PlayerData
  },
  status: "gathering" | "cluing" | "guessing",
  guessingViewState: {
    playerName: string,
    boardRotation: number,
    tiles: {
      x: number,
      y: number,
      rotation: number,
      words: string[],
      draggingUser?: string
    }[]
  }
}

export type PlayerData = {
  readyToGuess: boolean,
  readyToJoin: boolean,
  tilesAsClued: string[][],
  tilesForDistractors: string[][],
  tilesAsGuessed: string[][],
  numDistractors: number,
  clues: string[]
}

export const APP_ID = '8b53d611-dba7-4812-8800-8cf0dda28a5e'