Act as a senior full-stack web developer. We are adding an "Academy Mode" to our drawing game. This is a single-player educational progression system that teaches users how to draw through escalating difficulty levels using local SVG reference files.

Please implement the following progression engine and accuracy scoring system using HTML5 Canvas and vanilla JavaScript:

1. Asset Management & Level Configuration
* Create a JSON structure to define levels mapping to local files (e.g., `filepath: '/assets/Easy/apple.svg'`). Each level object should contain the filepath, a difficulty tier (1 through 4), and a target accuracy percentage required to pass.
* Write a `loadSVGToCanvas(filepath, canvasContext)` function. It must create an `Image()` object, set the `src`, and use the `onload` event to execute `ctx.drawImage()`. 
* Implement scaling logic inside the onload event to calculate the aspect ratio of the SVG, scaling and centering it perfectly within the assigned canvas boundaries without distortion.

2. Progressive Difficulty State Machine
* Tier 1 (Direct Tracing): The reference SVG is drawn directly onto the center of the user's main canvas at 30% opacity. The user traces over it.
* Tier 2 (Grid Tracing): Same as Tier 1, but render a rigid 8x8 or 16x16 grid overlay to help the user understand proportions.
* Tier 3 (Side-by-Side with Grid): The canvas area splits. The reference SVG is rendered on the left side with a grid overlay. The user's drawing area is on the right side with an identical blank grid. Include a small starting dot coordinate on the user's canvas to anchor their first stroke.
* Tier 4 (Freestyle): The reference SVG is displayed on the left without grids. The user must replicate it entirely freehand on the right side. Include color-matching targets where the user must select specific hex codes from the palette.

3. Accuracy Evaluation Engine (Canvas Pixel Matching)
* Implement a scoring function that fires when the user clicks "Submit."
* For Tiers 1 and 2: Extract the ImageData from the user's canvas and a hidden off-screen reference canvas (where the SVG is drawn at 100% opacity). Compare the bounding box of the user's drawn pixels against the reference image's pixels. Calculate an overlap percentage.
* For Tiers 3 and 4: Apply a coordinate offset to the reference image data to align it with the user's right-side drawing area, then perform the pixel overlap comparison.
* Implement a slight margin of error (e.g., a 3-pixel radius tolerance) so the tracing does not have to be mathematically perfect to score 100%.

Structure your response by providing the JSON level architecture, the SVG loading function, the client-side rendering logic for the four tier states (including generating the grid overlays), and the pixel-comparison algorithm for the scoring engine.