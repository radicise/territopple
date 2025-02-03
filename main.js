// helper script that allows for both servers to be started and controlled by one program

const { spawn } = require("child_process");
const rl = require("readline");


/**@type {import("child_process").ChildProcessWithoutNullStreams} */
let webserver = null;
/**@type {import("child_process").ChildProcessWithoutNullStreams} */
let gameserver = null;

/**@param {number} which */
function shutdown(which) {
    if (((which ?? 3) & 1) && webserver) {
        webserver.kill("SIGINT");
    }
    if (((which ?? 3) & 2) && gameserver) {
        gameserver.kill("SIGINT");
    }
}

/**@param {number} which */
function relaunch(which) {
    shutdown(which);
    if (!webserver) {
        webserver = spawn("node", ["webserver.js"]);
        webserver.stdout.on("data", (data) => {
            console.log(`webserver: ${data}`);
        });
        webserver.stderr.on("data", (data) => {
            console.error(`webserver: ${data}`);
        });
    }

    if (!gameserver) {
        gameserver = spawn("node", ["server.js"]);
        gameserver.stdout.on("data", (data) => {
            console.log(`gameserver: ${data}`);
        });
        gameserver.stderr.on("data", (data) => {
            console.log(`gameserver: ${data}`);
        });
    }
}

const i = rl.createInterface({input:process.stdin,output:process.stdout});

relaunch();

i.on("SIGINT", () => {
    i.close();
});

i.on("line", (l) => {
    switch (l) {
        case "rs":
            relaunch();
            break;
        case "rs web":
            relaunch(1);
            break;
        case "rs game":
            relaunch(2);
            break;
        case "stop":
            i.close();
            break;
        default:
            if ((/^pass-(web|game) .*$/).test(l)) {
                if (l[5] === 'w') {
                    webserver.stdin.write(l.substring(9));
                } else {
                    gameserver.stdin.write(l.substring(10));
                }
                break;
            }
            console.log("\x1b[38;2;200;20;0mUnrecognized\x1b[0m");
            break;
    }
});

i.on("close", () => {
    shutdown();
});
