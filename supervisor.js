/**
 * @file
 * ensures that all servers are properly started and will restart them if they fail
 */

const { spawn, ChildProcess } = require("child_process");
const { ensureFile, addLog, logStamp, settings } = require("./defs.js");

const servers = [
    { name: "data",
      cmd: "be-data",
      process: null },
    { name: "manager",
      cmd: "be-mngr",
      process: null },
    { name: "bots",
      cmd: "be-bots",
      process: null },
    { name: "server",
      cmd: "ac-serv",
      process: null },
    { name: "puzzles",
      cmd: "be-puzs",
      process: null }
];

const LOG = "logs/supervisor.txt";
ensureFile(LOG);
logStamp(LOG);

function addListeners() {
    for (const server of servers) {
	if (server.process !== null) {
	    server.process.removeAllListeners("exit");
	    server.process.addListener("exit", (code, signal) => {
		addLog(LOG, `${server.name} ended with code ${code} and signal ${signal}\n`);
		server.process = null;
		if (signal === null) {
		    startProcesses();
		}
	    });
	}
    }
}

function startProcesses() {
    for (const server of servers) {
	if (server.process === null) {
	    server.process = spawn("npm", ["run", server.cmd], {
		stdio: ['ignore', 'inherit', 'inherit']
	    });
	    addLog(LOG, `started ${server.name}\n`);
	}
    }
    addListeners();
}

function stopProcesses() {
    for (const server of servers) {
	if (server.process !== null) {
	    server.process.kill("SIGINT");
	    addLog(LOG, `stopped ${server.name}\n`);
	    server.process = null;
	}
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

startProcesses();
