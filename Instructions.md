Act as a senior frontend developer. We are updating the landing page UI for our game. 

Currently, the page has a single central login card. I want to shift this layout to be a side-by-side flexbox or grid. Keep the existing login card on the left, and add a new "Information Container" beside it on the right. 

Please implement the following in HTML, CSS, and vanilla JavaScript:

1. Layout Structure
* Wrap the existing login card and the new Information Container in a centered flexbox or grid layout so they sit side by side. Ensure it stacks vertically on smaller mobile screens.
* The new Information Container must match the existing UI aesthetic (thick black borders, rounded corners, solid background colors, and a neo-brutalist offset drop shadow).

2. Carousel & Dot Navigation
* The new Information Container must function as a single carousel that displays one section at a time.
* Add dot navigation (small clickable circles) at the bottom center of the container to switch between the sections.
* Write the vanilla JavaScript to handle clicking the dots, updating the active dot styling, and fading or sliding between the three content sections.

3. Content Sections (The Slides)
* Slide 1 (About): A clean, simple text area explaining that this is a Reverse Pictionary and Taboo party game.
* Slide 2 (Patch Notes): Design this specific slide creatively. Use CSS to make the background of the text look like a yellow "Post-it note" (slightly rotated, subtle drop shadow, handwritten-style font if possible) stuck inside the container. 
* Slide 3 (How to Play): A quick bulleted list explaining the Drawer and Describer mechanics.

Structure your response by providing the updated HTML layout, the CSS for the side-by-side alignment, the Post-it note styling, the dot navigation UI, and the JavaScript required to make the carousel function.