Territopple is a multiplayer strategy game based on the game Culture by Secret Lab Pty. Ltd..  
  
Playable at [territopple.net](https://territopple.net)

# Contents
- [Gameplay](https://github.com/radicise/territopple?tab=readme-ov-file#gameplay)
- [Computer-based Game Interface](https://github.com/radicise/territopple?tab=readme-ov-file#computer-based-game-interface)

# Gameplay
The game is played on a rectangular board. Each tile on the board has a number of pieces on it, and is either owned or unowned.
The game starts with one piece on each tile. Players take turns placing pieces onto the board, either on spaces they own or spaces that are unowned.
If a tile has more pieces on it than it has neighbors, it topples, resetting to one piece and adding a piece to each neighbor.
This can in turn cause those tiles to topple as well. If a tile topples onto a tile owned by someone else or unowned, that tile is captured.
If a player has no valid moves, they lose. The game ends when one person owns all the tiles on the board.

# Computer-based Game Interface
The game implementation exists a clients-and-server system accessible as a web page, using on the host's side by default the incoming ports 80 and 81.
The webpages are to be hosted by HTTP, and the rest of the server is written for Node.js.
To run the server, run 'npm run start' with the working directory being the root of the repository with the '/www' directory hosted as the root directory of an HTTP server.
Connecting clients may then open '/index.html' on a modern web browser and play the game.

# Documentation
All server documentation can be found in the `/zserver/docs` directory. All replay format documentation can be found in the `/replay-format` directory. Puzzle documentation can be found in the `/puzzles/format.txt` file. TerriTopple Virtual Machine documentation can be found in the `/ttvm` directory.  
The `/protocol.txt` file is incomplete and outdated.  
High level documentation on '.topl', '.stpl', '.ctpl', and '.ttpl' files can be found in the `/replay-format/variant-notes.txt` file.
