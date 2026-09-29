#!/usr/bin/cjs

var GLib = imports.gi.GLib;
imports.searchPath.unshift(GLib.get_current_dir() + "/port-radar@pedropaulo/lib");
var Scanner = imports.scanner;

function assert(condition, message) {
    if (!condition)
        throw new Error("Assertion failed: " + message);
}

var argv = Scanner.createScanArgv();
assert(argv.join(" ") === "/usr/bin/ss -H -lntup -n -4", "scanner uses an explicit safe argv for numeric TCP and UDP sockets");
assert(!argv.join(" ").includes("sh -c"), "scanner does not invoke a shell");

var scanner = new Scanner.TcpScanner();
assert(typeof scanner.scan === "function", "scanner exposes scan");
assert(typeof scanner.cancel === "function", "scanner exposes cancel");
scanner.cancel();

print("scanner-tests: PASS");
