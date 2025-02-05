/**
 * @param {number} rorig
 * @param {number} corig
 * @param {number} team
 * @param {Game} game
 * @returns {boolean}
 */
function updateboard(rorig, corig, team, game) {
	const rows = game.rows;
	const cols = game.cols;
	const tiles = rows * cols;
	const adds = [corig, rorig];
	while (adds.length) {
		const row = adds.pop();
		const col = adds.pop();
		let nv = ++(game.board[(row * cols) + col]);
		let nm = 5;
		if ((col == 0) || (col == (cols - 1))) {
			nm--;
		}
		if ((row == 0) || (row == (rows - 1))) {
			nm--;
		}
		if (nv >= nm) {
			game.board[(row * cols) + col] -= (nm - 1);
			if (col != 0) {
				adds.push(col - 1, row);
			}
			if (col != (cols - 1)) {
				adds.push(col + 1, row);
			}
			if (row != 0) {
				adds.push(col, row - 1);
			}
			if (row != (rows - 1)) {
				adds.push(col, row + 1);
			}
		}
		if (game.teamboard[(row * cols) + col] != team) {
			game.owned[game.teamboard[(row * cols) + col]]--;
			game.teamboard[(row * cols) + col] = team;
			if ((++game.owned[team]) == tiles) {
				return true;
			}
		}
	}
	return false;
}

exports.updateboard = updateboard;
