<script lang="ts">

  export let words: string[];
  export let angle: number = 0;
  export let position: {x: number, y: number};
  export let onTileMove;
  export let boardMoving;
  export let movable = false;

  import { onMount } from "svelte";

  let activeSquare = null;

  export let tile;
  export let moving = false;
  const rotate = () => {
    angle -= 90;
  };
  onMount(() => {
    console.log("mounted");
    let square = tile;
    console.log("square", square);
    square.addEventListener("touchstart", startDrag);
    square.addEventListener("mousedown", startDrag);

    let initialX, initialY;
    let initialPosition;

    function startDrag(e) {
      if (!movable) return;
      moving = false;
      activeSquare = e.target.closest(".draggable-square");
      initialX = (e.touches?.[0] || e).clientX;
      initialY = (e.touches?.[0] || e).clientY;
    initialPosition = {x: position.x, y: position.y}

      window.addEventListener("touchmove", drag);
      window.addEventListener("mousemove", drag);

      window.addEventListener("touchend", endDrag);
      window.addEventListener("mouseup", endDrag);
    }

    let newX, newY;
    function drag(e) {
      if (!activeSquare) return;

      moving = true;
      e.preventDefault();
      newX = (e.touches?.[0] || e).clientX - initialX;
      newY = (e.touches?.[0] || e).clientY - initialY;

      position.x = initialPosition.x + newX;
      position.y = initialPosition.y + newY;

      onTileMove?.()
    }

    function endDrag() {
      activeSquare = null;
      window.removeEventListener("touchmove", drag);
      window.removeEventListener("mousemove", drag);
      window.removeEventListener("touchend", endDrag);
      window.removeEventListener("mouseup", endDrag);

      if (!moving) {
        return;
      }

      setTimeout(() => {
        moving = false;
        onTileMove?.()
      });

    }
    console.log("listening");
  });
  // increment rotation on the parent square, found by navigating up the DOM tree
  const ccw = (e) => {
    if (moving) return false;
    rotate();
    onTileMove?.()
  };
</script>

<div bind:this={tile} class="draggable-square" class:noanimate={boardMoving} class:moving={moving}
  style:rotate={`${angle}deg`}
  style:left={`${position.x-50}px`}
  style:top={`${position.y-50}px`}
  on:click={movable ? ccw : () => {}}
   >
  <span class="top">{words[0]}</span>
  <span class="right">{words[1]}</span>
  <span class="bottom">{words[2]}</span>
  <span class="left">{words[3]}</span>
</div>

<style>
  .draggable-square.moving {
    border: 2px dashed white;
    opacity: .8;
  }
  .draggable-square {
    width: 100px;
    height: 100px;
    position: absolute;
    display: flex; /*child button centered horizontally and vertically*/
    justify-content: center;
    align-items: center;
    border-radius: 10px;
    /* animate any rotations of this*/
    transform: scale(1.2);
    transition: rotate 0.3s ease;
    cursor: pointer;
    user-select: none;
    background-color: rgb(18, 74, 18);
    opacity: .95;
    border: 2px solid black;
    font-weight: bold;
    font-size: 15px;
    text-transform:capitalize;
    font-family: 'Gill Sans', 'Gill Sans MT', Calibri, 'Trebuchet MS', sans-serif;

  }

  .draggable-square .left {
    color: white;
    position: absolute;
    top: 50%;
    transform: translateY(54px) rotate(-90deg);
    transform-origin: -4px 0%;
    padding: 0px;
    width: 100px;
    text-align: center;
  }

  .draggable-square .right {
    color: white;
    position: absolute;
    top: 50%;
    right: 0;
    transform: translateY(54px) rotate(90deg);
    transform-origin: 104px 0%;
    padding: 0px;
    width: 100px;
    text-align: center;
  }

  .draggable-square .top {
    color: white;
    position: absolute;
    right: 50%;
    top: -4px;
    transform: translateX(50%) rotate(0deg);
    transform-origin: 0% 0;
  }

  .draggable-square .bottom {
    color: white;
    position: absolute;
    right: 50%;
    transform: translateY(44px) translateX(50%) rotate(180deg);
    transform-origin: 50% 50%;
  }

  .draggable-square button {
    width: 12px;
    height: 12px;
    padding: 1em;
    display: flex;
    justify-content: center;
    align-items: center;
  }

  .noanimate {
    transition: none !important;
  }
</style>
