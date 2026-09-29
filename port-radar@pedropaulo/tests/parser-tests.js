#!/usr/bin/cjs

var GLib = imports.gi.GLib;
var ByteArray = imports.byteArray;
imports.searchPath.unshift(GLib.get_current_dir() + "/port-radar@pedropaulo/lib");
var Parser = imports.parser;
var Model = imports["socket-model"];
function assert(condition, message) {
    if (!condition)
        throw new Error("Assertion failed: " + message);
}

function assertEqual(actual, expected, message) {
    assert(actual === expected, message + " (expected " + expected + ", got " + actual + ")");
}

var fixturePath = GLib.get_current_dir() + "/port-radar@pedropaulo/tests/fixtures/ss-tcp.txt";
var fixture = ByteArray.toString(GLib.file_get_contents(fixturePath)[1]);
var records = Parser.parseSsOutput(fixture);

assertEqual(records.length, 4, "valid TCP rows are parsed while malformed rows are ignored");
assertEqual(records[0].protocol, "TCP", "protocol is normalized");
assertEqual(records[0].family, "IPv4", "IPv4 family is detected");
assertEqual(records[0].address, "127.0.0.1", "loopback address is preserved");
assertEqual(records[0].port, 8080, "port is numeric");
assertEqual(records[0].processName, "python", "process name is parsed");
assertEqual(records[0].pid, 1234, "PID is parsed");

assertEqual(records[1].address, "0.0.0.0", "wildcard address is preserved");
assertEqual(records[1].processes.length, 2, "multiple processes are retained");
assertEqual(records[1].displayProcess, "nginx, worker", "multiple process names are displayable");
assert(records[1].identity !== records[0].identity, "duplicate ports do not share identity");

assertEqual(records[2].family, "IPv6", "bracketed IPv6 family is detected");
assertEqual(records[2].address, "::1", "IPv6 brackets are removed from address");
assertEqual(records[2].port, 631, "IPv6 port is parsed");

assertEqual(records[3].processName, "Unknown process", "missing process metadata is explicit");
assertEqual(records[3].pid, null, "missing PID is represented as null");
assertEqual(Parser.parseSsOutput("" ).length, 0, "empty output is safe");
assertEqual(Parser.parseSsOutput("garbage\n").length, 0, "unexpected output is safe");

let mixed = Parser.parseSsOutput('tcp LISTEN 0 128 127.0.0.1:8080 0.0.0.0:* users:(("python",pid=12,fd=3))\nudp UNCONN 0 0 [fe80::1]%eth0:546 [::]:*');
assertEqual(mixed.length, 2, "mixed ss output includes the protocol column");
assertEqual(mixed[1].address, "fe80::1%eth0", "IPv6 scope is preserved");
assertEqual(Parser.parseEndpoint("localhost:"), null, "missing port is rejected");
print("parser-tests: PASS");
