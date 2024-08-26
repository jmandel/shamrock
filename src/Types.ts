export type Schema = {
  room: Room,
  player: Player
}
export type Room = {
  id: string,
  name: string,
  currentPlayer: Player,
  joinedPlayers: Player[],
  status: "gathering" | "cluing" | "guessing",
  guessingViewState: {
    boardRotation: number,
    tiles: {x: number, y: number, rotation: number, words: string[]}[]
  }
}

export type Player = {
  id: string,
  name: string,
  currentInRoom: Room,
  joinedRoom: Room,
  readyToGuess: boolean,
  readyToJoin: boolean,
  tilesAsClued: string[][],
  tilesAsGuessed: string[][]
}


export const APP_ID = '8b53d611-dba7-4812-8800-8cf0dda28a5e'