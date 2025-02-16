function toBytes(n) {
    return [(n>>8)&0xff,n&0xff];
    // return [(n>>24)&0xff,(n>>16)&0xff,(n>>8)&0xff,n&0xff];
}
/**
 * @param {number} n
 * @param {number} c
 * @returns {number[]}
 */
function nbytes(n, c) {
	return [n&0xff,(n>>8)&0xff,(n>>16)&0xff,(n>>24)&0xff,(n>>32)&0xff,(n>>40)&0xff,(n>>48)&0xff,(n>>56)&0xff].slice(0, c).reverse()
}

/**
 * @param {number} rorig
 * @param {number} corig
 * @param {number} team
 * @param {import("./server").Game} game
 * @returns {boolean}
 */
function updateboard(rorig, corig, team, game, dummy) {
    // if (!dummy) game.buffer.push(...toBytes(rorig), ...toBytes(corig));
    if (!dummy) {
		if (game.buffer[2][0] & (1<<7)) {
			const ntime = Date.now();
			const dtime = ntime - game.timestamp;
			game.timestamp = ntime;
			if (dtime > 65535) {
				game.buffer.push(Buffer.of(2, ...nbytes(dtime, 3), 1, 0, 0));
			} else {
				game.buffer.push(Buffer.of(1, ...toBytes(dtime)));
			}
		} else {
			game.buffer.push(Buffer.of(1));
		}
		game.buffer.push(Buffer.of(rorig&0xff, corig&0xff));
	}
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
			let lt = game.teamboard[(row * cols) + col];
			game.owned[lt]--;
			if ((game.owned[lt] == 0) && (game.owned[0] == 0)) {
				if (lt) {
                    if (!dummy) game.buffer.push(0xf0,lt);
					game.inGame[lt] = 0;
					game.inGameAmount--;
				}
				else {
					for (let i = 1; i < game.owned.length; i++) {
						if (!(game.owned[i])) {
                            if (!dummy) game.buffer.push(Buffer.of(0,0,0,i));
							game.inGame[i] = 0;
							game.inGameAmount--;
						}
					}
				}
			}
			game.teamboard[(row * cols) + col] = team;
			if ((++game.owned[team]) == tiles) {
				return true;
			}
		}
	}
	return false;
}

exports.updateboard = updateboard;
exports.nbytes = nbytes;
