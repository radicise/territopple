/**
 * @file
 * ensures that all servers are properly started and will restart them if they fail
 */

const { spawn, ChildProcess } = require("child_process");
const { ensureFile, addLog, logStamp } = require("./defs.js");

/**@type {ChildProcess} */
let manager_proc = null;
/**@type {ChildProcess} */
let data_proc = null;
/**@type {ChildProcess} */
let bot_proc = null;

const LOG = "logs/supervisor.txt";
ensureFile(LOG);
logStamp(LOG);

function addListeners() {
    manager_proc.removeAllListeners("exit");
    manager_proc.addListener("exit", (code, signal) => {
        addLog(`manager ended with code ${code} and signal ${signal}`);
        if (signal === null) {
            startProcesses()
        }
    });
    data_proc.removeAllListeners("exit");
    data_proc.addListener("exit", (code, signal) => {
        addLog(`data ended with code ${code} and signal ${signal}`);
        if (signal === null) {
            startProcesses()
        }
    });
    bot_proc.removeAllListeners("exit");
    bot_proc.addListener("exit", (code, signal) => {
        addLog(`bots ended with code ${code} and signal ${signal}`);
        if (signal === null) {
            startProcesses()
        }
    });
}

function startProcesses() {
    if (manager_proc === null) {
        manager_proc = spawn("npm run be-mngr");
        addLog("started manager");
    }
    if (data_proc === null) {
        data_proc = spawn("npm run be-data");
        addLog("started data");
    }
    if (bot_proc === null) {
        bot_proc = spawn("npm run be-bots");
        addLog("started bots");
    }
    addListeners();
}
function stopProcesses() {
    if (manager_proc !== null) {
        manager_proc.kill("SIGINT");
        addLog("stopped manager");
        manager_proc = null;
    }
    if (data_proc !== null) {
        data_proc.kill("SIGINT");
        addLog("stopped data");
        data_proc = null;
    }
    if (bot_proc !== null) {
        bot_proc.kill("SIGINT");
        addLog("stopped bots");
        bot_proc = null;
    }
}

process.addListener("SIGHUP", () => {
    stopProcesses();
    startProcesses();
});
process.addListener("SIGUSR1", () => {
    // if (manager_proc !== null || data_proc !== null || bot_proc !== null) {
    //     addLog(LOG, "failed to start, processes still running");
    //     return;
    // }
    startProcesses();
});
process.addListener("SIGUSR2", () => {
    stopProcesses();
});

