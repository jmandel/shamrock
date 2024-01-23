/* eslint-env browser */

import * as Y from "yjs";
import { WebrtcProvider } from "y-webrtc";
import prand from "pure-rand";
import shuffleSeed from "knuth-shuffle-seeded";
import cards from "../assets/shamrock.json";
import { WebsocketProvider } from "y-websocket";


const roomName = "squad";
const documentGuid = `shamrock-${
  new Date().toISOString().slice(0, 10)
}-${roomName}`;

export const ydoc = new Y.Doc({ guid: documentGuid });
const provider = new WebrtcProvider("shamrock", ydoc, {
  signaling: ["wss://shamrock.fly.dev"],
  filterBcConns: false,
});



// const provider = new WebsocketProvider(
//   'ws://localhost:1234',"shamrock", ydoc
// )

// const players = ydoc.getMap("players")
// players.set("Josh", {
//     name: "Josh",
//     color: "red",
//     order: 2,
//     font: "comic-sans",
//     clues: [
//         ["clue one", "ctwo", "cthree", "cfour"],
//         ["cfive", "csix", "cseven", "ceight"],
//     ]
// })

// const guesses = ydoc.getMap("guesses");


// const context = ydoc.getMap("activity");
// context.set("activity", {round: 0, phase: "write"})
// context.set("activity", {round: 0, phase: "guess", host: "josh", "step": 0})

// context.observe((d) => {
//   context.toJSON().stage
// })

// const yarray = ydoc.getArray("cards");

// yarray.observe(() => {
//   console.log(
//     JSON.stringify(yarray.toJSON().slice(0, 10), null, 2),
//     yarray.toJSON().length,
//   );
//   if (yarray.length === 0) {
//     yarray.insert(0, cards);
//   }
//   console.log(yarray.toJSON().length);
//   // if (yarray.length > 220)
//   // yarray.delete(0, yarray.length - 220);
// });

// if (window.location.hash === "#reset") {
//     yarray.delete(0, yarray.length);
//     yarray.insert(0, await deck(documentGuid, cards));
// }


// @ts-ignore
window.example = { provider, ydoc, };

export const  deck = await makeDeck(documentGuid, cards);
async function makeDeck(documentGuid: string, cards: string[][]) {
  let digest = new Uint8Array(
    await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(documentGuid),
    ),
  );
  let seedNumeric = digest.reduce((acc, val) => acc * 256 + val, 0);
  let prng = prand.xoroshiro128plus(seedNumeric);
  let cards2 = shuffleSeed(cards, seedNumeric);
  let cards3 = cards2.map((c) => {
    const shiftBy = Math.floor(prng.unsafeNext() * 4);
    return c.slice(shiftBy).concat(c.slice(0, shiftBy));
  });
  return cards3;
}

export const shufflePlayers = (players: string[]) => {
    let ret = [...players];
    ret.sort()
    return ret;
}