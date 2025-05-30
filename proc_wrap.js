const { spawn } = require("child_process");
const rl = require("readline");


/**@type {import("child_process").ChildProcessWithoutNullStreams} */
let child = null;

function shutdown() {
    if (child !== null) {
        child.kill("SIGINT");
        child = null;
    }
}

function relaunch() {
    shutdown();
    child = spawn("node", process.argv.slice(2));
    child.stdout.on("data", (data) => {
        console.log(`data: ${data}`);
    });
    child.stderr.on("data", (data) => {
        console.log(`error: ${data}`);
    });
}

const i = rl.createInterface({input:process.stdin,output:process.stdout});

relaunch();

i.on("SIGINT", () => {
    i.close();
});
let passthrough = false;
i.on("line", (l) => {
    switch (l) {
        case "rs":
            relaunch();
            break;
        case "stop":
            i.close();
            console.log("STOPPING");
            break;
        case "#child":
            passthrough = true;
            break;
        default:
            // if ((/^pass-(web|game) .*$/).test(l)) {
            //     if (l[5] === 'w') {
            //         webserver.stdin.write(l.substring(9));
            //     } else {
            //         gameserver.stdin.write(l.substring(10));
            //     }
            //     break;
            // }
            if (passthrough) {
                if (l !== "#main") {
                    child.stdin.write(l);
                } else {
                    passthrough = false;
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
