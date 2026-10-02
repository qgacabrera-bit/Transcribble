Act as a senior full-stack web developer. We are adding a completely new game mode to our Node.js and Socket.io drawing game called "Impostor Mode". 

In this mode, players share a single canvas and take sequential turns drawing to hint at a secret word, but one player is the Impostor and does not know the word.

Please implement the following complex state machine in server.js and the corresponding UI updates in client.js:

1. Role Assignment & Initialization (server.js)
* When the game starts, randomly assign one player as the "Impostor". The rest are "Regulars".
* Emit the secret word to all Regulars. 
* Emit a specific payload to the Impostor that hides the word and displays: "You are the impostor, try to blend in with the players."
* Initialize a hidden scoring system for all players.

2. Turn-Based Drawing Loop (server.js & client.js)
* Implement a turn queue. Only the "active" player has write access to the HTML5 canvas. All other clients must have their canvas locked (read-only).
* Give the active player exactly 10 seconds to draw. Display a synchronized countdown timer on all clients.
* When the 10 seconds expire, immediately pass canvas control to the next player in the queue.
* Track "rotations" (when every active player has taken one turn). The first drawing phase lasts for exactly 2 full rotations. 

3. Voting Phase (server.js & client.js)
* After the required drawing rotations, trigger a 'VOTING_PHASE' event.
* On the client, overlay a Voting UI showing all active players. Allow users to cast one vote.
* On the server, tally the votes after a set time limit. 
* If a player receives a strict majority, they are eliminated from the active queue.

4. Elimination & Progressive Rounds (server.js)
* If the eliminated player IS the Impostor: The game ends, Regulars win.
* If the eliminated player is NOT the Impostor: Apply a penalty to the Regulars' hidden scores, and award bonus survival points to the Impostor. 
* If 3 non-impostor players are eliminated total, the game ends, Impostor wins.
* If the game continues, start a new drawing phase with the remaining players. This subsequent drawing phase only lasts for 1 rotation before the next vote.

5. Scoring Logic (server.js)
* Ensure all points remain hidden in the backend state until the game concludes.
* Impostor scoring: Scales up based on how many voting rounds they survive.
* Regular player scoring: Award partial points if a player voted for the Impostor, even if the group majority eliminated the wrong person.
* At game over, broadcast the 'GAME_OVER' event with the final revealed scores and the Impostor's identity to update a leaderboard UI.

Structure your response by providing the new state machine logic for server.js (handling turns, timers, and voting tallies) and the client.js logic for toggling canvas interactivity and rendering the voting overlay.