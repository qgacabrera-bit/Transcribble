Act as a senior web game developer. We are adding a new single-player arcade mode to our HTML5 Canvas drawing game. It is an endless "Inkslaught" game where enemies spawn on the right side of the screen and move left, and the player must draw specific symbols to destroy them before they reach the left wall.

Please implement the complete game loop and gesture recognition logic in client.js.

1. Gesture Recognition Engine
* Integrate a lightweight unistroke gesture recognizer (such as the $1 Unistroke Recognizer algorithm) natively in vanilla JavaScript.
* Define a core dictionary of templates: Vertical Line, Horizontal Line, V-Shape, Caret (^), Circle, and Lightning Bolt.
* When the user triggers 'pointerup', pass the collected stroke points into the recognizer to return the matched shape name.

2. Game Entities & Horizontal Physics Loop
* Create an `Enemy` class with properties: x (starts at canvas.width), y (randomized within vertical bounds), speed, symbolArray, and width/height.
* Set up a `requestAnimationFrame` game loop that:
  - Clears the canvas.
  - Updates the X position of all active enemies, moving them leftward based on their speed.
  - Renders the enemies and draws their required symbols above them.
  - Renders the player's current live drawing stroke on top.

3. Combat & Difficulty Scaling (45-Second Phases)
* When the gesture recognizer returns a match, iterate through the active enemies (prioritizing those closest to the left wall). If an enemy's first required symbol matches the drawn gesture, remove that symbol. If their array is empty, destroy the enemy and add to the `score`.
* Implement a spawner function using a timer. Scale the difficulty based on `survivalTime` in strict 45-second intervals:
  - Phase 1 (0 to 45s): Spawn basic shapes (|, -, ^) slowly.
  - Phase 2 (45s to 90s): Decrease the spawn interval (more enemies) and slightly increase base movement speed.
  - Phase 3 (90s to 135s): Introduce complex shapes (Circles, Lightning Bolts) into the spawn pool.
  - Phase 4 (135s+): Spawn "Tank" enemies generated with an array of 2 to 4 symbols that must be drawn sequentially.

4. Game Over State
* Define a "City Wall" threshold on the left side of the canvas (e.g., x <= 50).
* If any enemy's X position crosses this left threshold, trigger a 'GAME OVER' state.
* Halt the animation loop, display the final score, and show a "Restart" button that resets the arrays and timers without reloading the page.

Provide the modular JavaScript code for the gesture recognizer, the entity classes, and the main requestAnimationFrame loop.