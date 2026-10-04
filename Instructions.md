Act as a senior frontend web developer. We need to restructure the landing page to support single-player options and build a standalone "Zen Mode" drawing sandbox. 

Please implement the following updates across index.html, style.css, and client.js:

1. Home Screen Three-Block Layout (index.html & style.css)
* Restructure the home screen into a responsive three-block layout (or clean card container grid):
  - Block 1 (Multiplayer): The existing room creation, room code entry, and matchmaking card.
  - Block 2 (Single Player): A new card introducing solo play. Feature a prominent "Zen Mode" launch button with a short description: "Relax and draw with symmetry mirrors. No timers, no rules, pure creation."
  - Block 3 (About / Info): The existing carousel card containing About, Patch Notes, and How to Play.
* Ensure all three cards share the same visual design language: thick black borders, rounded corners, pastel background accents, and neo-brutalist offset drop shadows.
* Make the layout wrap cleanly on mobile and tablet screens.

2. Screen Transition Management (client.js)
* Implement clean view switching between the Home Screen and the Zen Mode Canvas.
* When the user clicks "Play Zen Mode" in Block 2, hide the Home Screen containers and display the Zen Mode interface.
* Add an exit button ("Back to Home") in the Zen Mode header that smoothly returns the user to the landing screen without refreshing the page.

3. Zen Mode Symmetry Engine (client.js)
* Zen Mode runs entirely client-side on an HTML5 canvas (no Socket.io traffic needed).
* Implement multiple symmetry modes that players can toggle via a toolbar:
  - None: Standard freehand drawing.
  - Horizontal Mirror: Reflects strokes across the vertical center line (left to right).
  - Vertical Mirror: Reflects strokes across the horizontal center line (top to bottom).
  - Quad Mirror: Reflects strokes across both horizontal and vertical axes simultaneously (4 quadrants).
  - Kaleidoscope (8-Way): Reflects and rotates strokes across 8 radial segments centered on the canvas.
* Mathematical stroke mirroring: When a pointerdown or pointermove event fires at coordinate (x, y), compute and render the mirrored coordinates relative to the canvas center (canvas.width / 2, canvas.height / 2) in real time.

4. Zen Mode Toolbar & Aesthetics (index.html, style.css, client.js)
* Keep the interface peaceful and uncluttered.
* Include a symmetry toggle selector, brush size slider, eraser tool, and a clear canvas button.
* Provide a curated color palette with soft, calming pastel tones alongside default black and white.
* Add an "Export Image" button that calls canvas.toDataURL('image/png') so players can download their geometric artwork locally.

Structure your response with the complete HTML markup for the three-block home layout, the updated CSS styling for the cards and Zen Mode canvas view, and the vanilla JavaScript logic powering the view switching and symmetry stroke calculations.