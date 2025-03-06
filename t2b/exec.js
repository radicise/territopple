const { readFileSync, writeFileSync, existsSync, mkdirSync } = require("fs");
const path = require("path");
const { performance } = require("perf_hooks");

// Configuration
const HEX_CHARS = "0123456789abcdef";
const INPUT_DIR = "t";   // Input directory
const OUTPUT_DIR = "b";  // Output directory
const CHUNK_SIZE = 1024; // Process in chunks for large files

// Command-line parsing with enhanced flexibility
const parseArgs = () => {
    const args = process.argv.slice(2);
    let reverse = false;
    let target = null;

    for (let i = 0; i < args.length; i++) {
        if (args[i] === "-r") reverse = true;
        else if (args[i] === "-w" && i + 1 < args.length) target = args[++i];
        else if (!target) target = args[i];
    }

    if (!target) throw new Error("Expected target file argument");
    if (!/\..+?\..+$/.test(target)) throw new Error("Target must have two extensions (e.g., file.hex.bin)");
    return { reverse, target };
};

// Process file paths
const getPaths = (target, reverse) => {
    const writeTarget = target.slice(0, target.lastIndexOf("."));
    const readPath = path.join(__dirname, INPUT_DIR, target);
    const writePath = path.join(__dirname, OUTPUT_DIR, writeTarget);

    // Ensure directories exist
    [INPUT_DIR, OUTPUT_DIR].forEach(dir => {
        const dirPath = path.join(__dirname, dir);
        if (!existsSync(dirPath)) mkdirSync(dirPath, { recursive: true });
    });

    if (!existsSync(reverse ? writePath : readPath)) throw new Error(`File not found: ${reverse ? writePath : readPath}`);
    return { readPath, writePath };
};

// Hex to Binary (forward operation)
const hexToBinary = (readPath, writePath) => {
    const startTime = performance.now();
    const rawText = readFileSync(readPath, { encoding: "utf-8" });
    
    // Process text efficiently
    const textLines = rawText.split("\n").map(line => {
        const commentIndex = line.indexOf(";");
        return commentIndex >= 0 ? line.slice(0, commentIndex) : line;
    }).join(" ").replace(/\|/g, "");

    const hexValues = textLines.split(/\s+/).filter(v => v.length > 0);
    const data = new Uint8Array(hexValues.length);
    
    for (let i = 0; i < hexValues.length; i += CHUNK_SIZE) {
        const chunk = hexValues.slice(i, i + CHUNK_SIZE);
        chunk.forEach((v, idx) => {
            if (v[0] === "$") {
                data[i + idx] = parseInt(v.slice(1).replace(/[+_\-]/g, ""), 2);
            } else {
                data[i + idx] = parseInt(v, 16);
            }
        });
    }

    writeFileSync(writePath, Buffer.from(data));
    console.log(`Hex to Binary completed in ${(performance.now() - startTime).toFixed(2)}ms`);
};

// Binary to Hex (reverse operation)
const binaryToHex = (readPath, writePath) => {
    const startTime = performance.now();
    const data = new Uint8Array(readFileSync(readPath));
    const hexOutput = [];
    
    for (let i = 0; i < data.length; i += CHUNK_SIZE) {
        const chunk = data.slice(i, i + CHUNK_SIZE);
        const chunkText = Array.from(chunk)
            .map(v => `${HEX_CHARS[v >> 4]}${HEX_CHARS[v & 15]}`)
            .join(" ");
        hexOutput.push(chunkText);
    }

    const formattedText = hexOutput.join("\n");
    writeFileSync(writePath, formattedText, { encoding: "utf-8" });
    console.log(`Binary to Hex completed in ${(performance.now() - startTime).toFixed(2)}ms`);
};

// Main execution with error handling
const main = () => {
    try {
        const { reverse, target } = parseArgs();
        const { readPath, writePath } = getPaths(target, reverse);

        if (reverse) {
            binaryToHex(writePath, readPath);
        } else {
            hexToBinary(readPath, writePath);
        }
    } catch (error) {
        console.error(`Error: ${error.message}`);
        process.exit(1);
    }
};

main();
