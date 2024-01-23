<script lang="ts">
  import { deck, shufflePlayers, ydoc } from "./lib/sync.js";
  import Board from "./lib/Board.svelte";
  import shuffleSeed from "knuth-shuffle-seeded";

  const NUM_TILES = 5;
  let tiles = [];
  let boardAngle = 0;
  const remoteTiles = ydoc.getMap("tiles");
  const remotePlayers = ydoc.getMap("players");
  const remoteGuesses = ydoc.getMap("guesses");

  const remoteBegun = ydoc.getMap("global");
  remoteBegun.observe(() => {
    if (remoteBegun.get("begun")) {
      gameStatus.started = true;
    }
  });

  //   remoteGuesses.set("0/Josh", {
  //     a: [
  //         ["a", "b", "c", "d"],
  //         ["e", "f", "g", "h"],
  //         ["i", "j", "k", "l"],
  //         ["m", "n", "o", "p"],
  //     ],
  //     aCommitted: true,
  //     b: [
  //         null,
  //         ["e", "f", "g", "h"],
  //         null,
  //         null
  //     ],
  //     bCommitted: false,
  // })

  let gameStatus = {
    currentRound: 0,
    phase: "cluing",
    numberReady: 0,
    numberNeeded: 1,
    playerNames: [],
    rounds: [],
    playerNames: [],
    playerBeingGuessed: null,
    started: false,
    guessPhase: 0,
  };

  remotePlayers.observe(syncRound);
  remoteGuesses.observe(syncRound);

  let playerNameInProgress = "";
  let playerName = window.localStorage.getItem("playerName");
  if (playerName) {
    playerNameInProgress = playerName;
    joinGame()
  }

  function joinGame() {
    console.log("Joining game", playerNameInProgress);
    if (playerNameInProgress) {
      window.localStorage.setItem("playerName", playerNameInProgress);
      if (playerName) {
        remotePlayers.delete(playerName)
      }
      playerName = playerNameInProgress;
    }
    remotePlayers.set(playerName, { clues: [] });
    console.log("SET", playerName)
  }


  let clues = [null, null, null, null];
  let cluesReady = false;

  $: {
    console.log("ROUND STAT", gameStatus);
  }

  function syncRound() {
    const players = remotePlayers.toJSON();
    const guesses = remoteGuesses.toJSON();
    console.log("SYNC", JSON.stringify(ydoc.toJSON(), null, 2))

    let playerNames = shufflePlayers(Object.keys(players));
    const numPlayers = playerNames.length;

    const roundsToCounts = Object.keys(guesses)
      .filter((g) => guesses[g].reviewed)
      .map((k) => parseInt(k.split("/")[0]))
      .reduce((acc, r) => ({ ...acc, [r]: (acc[r] || 0) + 1 }), {});

    const completedRounds = Object.keys(roundsToCounts).filter(
      (r) => roundsToCounts[r] === numPlayers
    );
    console.log("RTC", roundsToCounts, completedRounds);
    const highestCompletedRound = completedRounds.length
      ? Math.max(...completedRounds)
      : -1;
    const currentRound = highestCompletedRound + 1;

    const numberReady = playerNames
      .map((p) => (players[p]?.clues?.length || 0) - 1)
      .filter((r) => r === currentRound).length;

    const numberNeeded = playerNames.length;
    const started = remoteBegun.get("begun");
    if (currentRound > gameStatus.currentRound) {
      cluesReady = false;
    }
    let nextGameStatus = {
      started,
      currentRound,
      phase: started && numberReady === numberNeeded ? "guessing" : "cluing",
      numberReady,
      numberNeeded,
      playerNames,
    };

    if (nextGameStatus.phase === "guessing") {
      const playerIndexBeingGuessed = Object.keys(guesses)
        .filter((g) => guesses[g].reviewed)
        .map((k) => [parseInt(k.split("/")[0]), k.split("/")[1]])
        .filter(([r, p]) => r === currentRound).length;

      const playerBeingGuessed = playerNames[playerIndexBeingGuessed];
      console.log(
        "Guessing now on player",
        playerIndexBeingGuessed,
        playerBeingGuessed
      );
      nextGameStatus["playerBeingGuessed"] = playerBeingGuessed;
      const guessPhase = guesses[`${currentRound}/${playerBeingGuessed}`];
      clues = players[playerBeingGuessed]?.clues[currentRound];
      console.log("Guess phase", guessPhase);
      nextGameStatus.guessPhase = guessPhase?.bCommitted
        ? 2
        : guessPhase?.aCommitted
          ? 1
          : 0;
    } else {
      if (gameStatus.phase === "guessing") {
        clues = [null, null, null, null];
      }
    }

    gameStatus = nextGameStatus;
  }

  function submitClues() {
    if (cluesReady) return;
    cluesReady = true;
    const current = remotePlayers.get(playerName) || {};
    current.clues = current.clues || [];
    current.clues[gameStatus.currentRound] = clues;
    remotePlayers.set(playerName, current);
    console.log("SEt new", remotePlayers.toJSON());
  }

  function submitGuess() {
    const guessKey = `${gameStatus.currentRound}/${gameStatus.playerBeingGuessed}`;
    const guess = remoteGuesses.get(guessKey) || {};

    if (!guess.aCommitted) {
      remoteGuesses.set(guessKey, {
        ...guess,
        a: tiles.map((t) => t.angle),
        aCommitted: true,
      });
    } else if (!guess.bCommitted) {
      remoteGuesses.set(guessKey, {
        ...guess,
        b: tiles.map((t) => t.angle),
        bCommitted: true,
      });
    } else {
      remoteGuesses.set(guessKey, {
        ...guess,
        reviewed: true,
      });
    }
  }
  function initialize(tiles, phase) {
    console.log("Initializing", tiles);
    let guessingPositions = [
      { x: 59, y: 470 },
      { x: 185, y: 470 },
      { x: 311, y: 470 },
      { x: 59, y: 600 },
      { x: 185, y: 600 },
      { x: 311, y: 600 },
    ];

    let guessingRotations = Array.from({ length: 4 }, (_,i) => -360-90*i).flatMap(v => [v,v,v,v]);

    let seedNumeric = (tiles[0]?.words || []).join("").split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
    guessingPositions = shuffleSeed(guessingPositions, seedNumeric);
    guessingRotations = shuffleSeed(guessingRotations, seedNumeric);
 
    const cluingPositions = [
      { x: 100, y: 130 },
      { x: 270, y: 130 },
      { x: 100, y: 300 },
      { x: 270, y: 300 },
      { x: 0, y: 0 },
      { x: 0, y: 0 },
    ];

    tiles.forEach((t, i) => {
      t.position = (phase === "guessing" ? guessingPositions : cluingPositions)[
        i
      ];
      t.angle = (phase == "guessing") ? guessingRotations[i] : 0;
    });
  }

  let lastGuessingPlayer = null;
  function setPhase(cluing, guessingPlayer) {
    console.log("In hase", gameStatus);
    if (cluing) {
      lastGuessingPlayer = null;
      remoteTiles.unobserve(syncTiles);
      remoteTiles.clear();
      const startDeckPos =
        gameStatus.numberNeeded * gameStatus.currentRound * 5 +
        Math.max(0, gameStatus.playerNames.indexOf(playerName)) * 5;
      console.log("START POST", startDeckPos);

      const nextTiles = deck
        .slice(startDeckPos, startDeckPos + 4)
        .map((w, i) => ({
          ...(tiles[i] || {}),
          words: w,
          angle: 0,
          position: {},
        }));
      if (
        nextTiles.map((t) => t.words.join(",")).join(",") !==
        tiles.map((t) => t.words.join(",")).join(",")
      ) {
        tiles = nextTiles;
        boardAngle = 0;
        initialize(tiles, "cluing");
      }

      console.log("RRR clue", gameStatus, tiles);
    } else {
      remoteTiles.observe(syncTiles);
      const guessingPlayerIndex =
        gameStatus.playerNames.indexOf(guessingPlayer);
      const startDeckPos =
        gameStatus.numberNeeded * gameStatus.currentRound * 5 +
        guessingPlayerIndex * 5;
      const nextTiles = deck
        .slice(startDeckPos, startDeckPos + 5)
        .map((w, i) => ({
          ...(tiles[i] || {}),
          words: w,
          angle: 0,
          position: {},
        }));
        if (lastGuessingPlayer !== guessingPlayer) {
          lastGuessingPlayer = guessingPlayer;
          tiles = nextTiles;
          remoteTiles.clear();
          boardAngle = 0;
          initialize(tiles, "guessing");
        }
      console.log("RRR guess", gameStatus, tiles, boardAngle);
    }
  }

  $: {
    setPhase(gameStatus.phase === "cluing", gameStatus.playerBeingGuessed);
  }

  function syncTiles(d) {
    Array.from(remoteTiles.keys()).forEach((k) => {
      if (k === "BOARD") {
        console.log("BOARD REMOTE", remoteTiles.get("BOARD"));
        boardAngle = remoteTiles.get("BOARD").angle;
        return;
      }
      const newK = remoteTiles.get("" + k);
      let tile = tiles[parseInt(k)];
      tiles[parseInt(k)] = { ...tile, ...newK };
      console.log("NEWK", newK)
      tiles = tiles;
    });
  }

  function onBoardMove() {
    console.log("OBM", boardAngle, remoteTiles.get("BOARD")?.angle)
    const angle = remoteTiles.get("BOARD")?.angle || 0;
    remoteTiles.set("BOARD", { angle: angle - 90});
  }

  function onTileMove(i, t) {
    const mtime = new Date().getTime();
    let a = t.angle;
    console.log("Moved", i, t, a, mtime);
    remoteTiles.set("" + i, { angle: a, mtime, position: t.position, moving: t.moving});
  }

$: {console.log("OUT BAORD ANG", boardAngle)}


</script>

<header>
  {#if playerName && gameStatus.started && gameStatus.phase === "cluing"}
    You: {playerName?.slice(0, 10)}.
    <button disabled={cluesReady} on:click={submitClues}>Clues Ready</button>
  {:else if playerName && gameStatus.started && gameStatus.phase === "guessing"}
    Guessing: {gameStatus.playerBeingGuessed?.slice(0, 10)}.
    <button on:click={submitGuess}>
      {gameStatus.guessPhase === 0
        ? "1st Guess"
        : gameStatus.guessPhase === 1
          ? "2nd Guess"
          : "Continue"}
    </button>
  {:else if !playerName || !gameStatus.started}
    <form on:submit|preventDefault={joinGame}>
      <input autofocus bind:value={playerNameInProgress} />
      <button type="submit">Join</button>
    </form>
    <ul>
      {#each gameStatus.playerNames as p}
        <li>{p}</li>
      {/each}
    </ul>
    {#if !gameStatus.started}
      <button on:click={() => remoteBegun.set("begun", true)}>Start Game</button
      >
    {/if}
  {/if}
</header>
{#if gameStatus.started}
  <Board
    bind:boardAngle={boardAngle}
    round={gameStatus.currentRound}
    phase={gameStatus.phase}
    bind:box={clues}
    {tiles}
    {onTileMove}
    {onBoardMove}
  />
{/if}

<style>
  header {
    position: absolute;
    top: 0px;
    left: 0px;
    font-size: 11px;
    font-weight: bold;
    text-align: center;
    width: 100%;
  }

  :global(html, body, #app, main, div.board) {
    max-width: 375px;
    max-height: 800px;
    height: 100%;
    width: 100%;
    margin: 0px;
    padding: 0px;
    position: relative;
    margin-left: auto;
    margin-right: auto;
    overflow-y: hidden;
    overflow-x: hidden;
  }
</style>
