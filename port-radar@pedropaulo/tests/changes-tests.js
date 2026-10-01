#!/usr/bin/cjs
const GLib = imports.gi.GLib;
imports.searchPath.unshift(GLib.get_current_dir() + "/port-radar@pedropaulo/lib");
const Parser = imports.parser;
const Changes = imports["change-detector"];
function check(condition, message) {
    if (!condition)
        throw new Error(message);
}
const before = Parser.parseSsOutput('tcp LISTEN 0 128 127.0.0.1:8080 0.0.0.0:* users:(("server",pid=10,fd=3))');
const newOwner = Parser.parseSsOutput('tcp LISTEN 0 128 127.0.0.1:8080 0.0.0.0:* users:(("server",pid=11,fd=3))');
const newAddress = Parser.parseSsOutput('tcp LISTEN 0 128 0.0.0.0:8080 0.0.0.0:* users:(("server",pid=10,fd=3))');
check(Changes.compareSnapshots(before, before).length === 0, "Unchanged sockets should not add history");
check(Changes.compareSnapshots([], before)[0].type === "opened", "Opening a socket should add history");
check(Changes.compareSnapshots(before, [])[0].type === "closed", "Closing a socket should add history");
check(Changes.compareSnapshots(before, newOwner)[0].type === "ownership-changed", "Changing PID should be detected");
let binding = Changes.compareSnapshots(before, newAddress);
check(binding.length === 1 && binding[0].type === "binding-changed", "Changing address should produce one event");
const unrelated = Parser.parseSsOutput('tcp LISTEN 0 128 0.0.0.0:8080 0.0.0.0:* users:(("other-server",pid=20,fd=3))');
let replacement = Changes.compareSnapshots(before, unrelated);
check(replacement.length === 2 && replacement.some(change => change.type === 'opened') &&
    replacement.some(change => change.type === 'closed'),
    'Different address and owner must remain separate opening and closing events');
const unknownBefore = Parser.parseSsOutput('tcp LISTEN 0 128 127.0.0.1:8080 0.0.0.0:*');
const unknownAfter = Parser.parseSsOutput('tcp LISTEN 0 128 0.0.0.0:8080 0.0.0.0:*');
check(Changes.compareSnapshots(unknownBefore, unknownAfter).length === 2,
    'Missing owners must not be guessed to be the same service');
const multipleBefore = Parser.parseSsOutput('tcp LISTEN 0 128 127.0.0.1:8080 0.0.0.0:* users:(("b",pid=2,fd=3),("a",pid=1,fd=4))');
const multipleAfter = Parser.parseSsOutput('tcp LISTEN 0 128 127.0.0.1:8080 0.0.0.0:* users:(("a",pid=1,fd=4),("b",pid=2,fd=3))');
check(Changes.compareSnapshots(multipleBefore, multipleAfter).length === 0,
    'Changing process output order must not create a history event');
print("changes-tests: PASS");
