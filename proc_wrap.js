const { spawn } = require("child_process");
const rl = require("readline");

/**@type {import("child_process").ChildProcessWithoutNullStreams} */
let child = null;

function shutdown() {
    if (child !== null) {
        child.kill("SIGINT");
        // child.kill("SIGKILL");
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
    child.on("error", (err) => {
        console.log(`ERROR: ${err}`);
    });
    if (process.argv.includes("--auto-restart")) {
        child.on("exit", (code, signal) => {
            if (signal) return;
            if (code === 0) return;
            relaunch();
        });
    }
}

relaunch();

if (!process.argv.includes("--no-in")) {
    const i = rl.createInterface({input:process.stdin,output:process.stdout});
    
    i.on("SIGINT", () => {
        i.close();
    });
    let passthrough = false;
    i.on("line", (l) => {
        switch (l) {
            case "kill":
                process.exit(1);
                break;
            case "rs":
                relaunch();
                break;
            case "stop":
                shutdown();
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
}
