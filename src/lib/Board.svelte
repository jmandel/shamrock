<script lang="ts">
  import { afterUpdate } from 'svelte';
  import shamrock from '../assets/shamrocklite.svg'
  import Tile from "./Tile.svelte";

  let board;
  export let boardAngle = null;

  export let tiles = [];
  export let onTileMove;
  export let onBoardMove;
  export let phase;

  export let box = [null, null, null, null];
  function center(div) {
      var rect = div.getBoundingClientRect();
      return {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2
      }
  }


function calculateNewCenter(targetDiv, pivotDiv) {
    // Calculate the center of the pivot element
    // Calculate the center of the target div
    const pivotCenter = center(pivotDiv)
    const targetCenter = center(targetDiv)

    // Calculate the new position of the target div's center after rotation
    var dx = targetCenter.x - pivotCenter.x;
    var dy = targetCenter.y - pivotCenter.y;
    // return { x: pivotCenter.x + dy, y:  pivotCenter.y - dx};
    return {dx: pivotCenter.x + dy - targetCenter.x, dy: pivotCenter.y-dx - targetCenter.y}
}


$: {console.log("BAORD ANG", boardAngle)}

function rotateBoard() {
  console.log("0CAlling OBM", boardAngle)
  tiles.forEach((t,i) => {
    console.log("TEst tile, ", t)
    if (isMoreThanHalfOverlapping(t.tile, board)) {
      const offsetX = t.tile.getBoundingClientRect().left - (t.position.x-50);
      const offsetY = t.tile.getBoundingClientRect().top - (t.position.y-50);

      let after = calculateNewCenter(t.tile, board);
      console.log("AFTER", t, after)
      t.position.x += after.dx;
      t.position.y += after.dy;
      //t.words = t.words.slice(1).concat(t.words[0])
      t.angle -= 90;
      // t.boardMoving = true;
      onTileMove(i, t);
      // setTimeout(() => {
      //   tiles[i].boardMoving = false;
      // }, 100);
      tiles = tiles
    }
  })
  boardAngle -= 90;
  setTimeout(()=>{ 
    console.log("1CAlling OBM", boardAngle)
    onBoardMove()
  })
}

function isMoreThanHalfOverlapping(tileDiv, boardDiv) {
    // Get the rectangles
    var tileRect = tileDiv.getBoundingClientRect();
    var boardRect = boardDiv.getBoundingClientRect();

    // Calculate the overlapping rectangle
    var x_overlap = Math.max(0, Math.min(tileRect.right, boardRect.right) - Math.max(tileRect.left, boardRect.left));
    var y_overlap = Math.max(0, Math.min(tileRect.bottom, boardRect.bottom) - Math.max(tileRect.top, boardRect.top));
    var overlapArea = x_overlap * y_overlap;

    // Calculate the area of the tile
    var tileArea = tileRect.width * tileRect.height;

    // Check if overlap is more than 50% of the tile's area
    return overlapArea > 0.5 * tileArea;
}

</script>


<div  class="board">
<div  class="rboard" bind:this={board}
style:width="373px"
style:height="373px"
 style:border={"1px solid black"} style:rotate={`${boardAngle}deg`}
>
  <img  alt="board" class="shamrock" src={shamrock} on:click={rotateBoard}/>
    <input readonly={phase === "guessing"} type="text" class="top"  bind:value={box[0]} placeholder={tiles[0]?.words?.[0] + " & " + tiles[1]?.words?.[0] }/>
    <input readonly={phase === "guessing"} type="text" class="right" bind:value={box[1]} placeholder={tiles[1]?.words?.[1] + " & " + tiles[3]?.words?.[1]} />
    <input readonly={phase === "guessing"} type="text" class="bottom" bind:value={box[2]} placeholder={tiles[3]?.words?.[2] + " & " + tiles[2]?.words?.[2]} />
    <input readonly={phase === "guessing"} type="text" class="left" bind:value={box[3]} placeholder={tiles[2]?.words?.[3] + " & " + tiles[0]?.words?.[3]} />
</div>
</div>

{#each tiles as t, i}
  <Tile movable={phase==="guessing"} onTileMove={(moving) => onTileMove(i, t)} boardMoving={t.boardMoving} bind:angle={t.angle} bind:tile={t.tile} bind:position={t.position} bind:words={t.words} bind:moving={t.moving}/>
{/each}

<style>
  input {
    width: 80%;
    position:absolute;
    margin: 0px;
    padding: 0px;
    border: 0px;
    box-sizing: border-box;
    text-align: center;
    font-size: 1.5em;
    opacity: .9;
    font-family: "Courier New", Courier, monospace;
    font-weight: bold;
  }
  img.shamrock {
    width: 100%;
    top: 0px;
    left: 0px;
    position:absolute;
  }
  div.board {
    top: 30px;
    user-select: none;
  }

  div.rboard {
    transition: rotate 0.1s ease;
  }

  input:disabled {
    font-weight: bold;
  }

  input.left {
    top: 90%;
    left: 0;
    width: 80%;
    transform: rotate(-90deg);
    transform-origin: 0% 0%;
    padding: 0px;
    text-align: center;
  }
  input.right {
    top: 90%;
    right: 0;
    transform: rotate(90deg);
    transform-origin: 100% 0%;
    padding: 0px;
    text-align: center;
  }

  input.top {
    top: 0px;
    left: 10%;
  }

  input.bottom {
    bottom: 0px;
    left: 10%;
    transform: rotate(180deg);
  }

</style>

