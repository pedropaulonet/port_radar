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

// Drive Gio's completion boundary and GLib's deadline deterministically; the
// scanner and parser remain real, without waiting ten seconds for each case.
const ByteArray = imports.byteArray;
const Parser = imports.parser;
const scannerSource = ByteArray.toString(GLib.file_get_contents(GLib.get_current_dir() + '/port-radar@pedropaulo/lib/scanner.js')[1]);
function environment(options = {}) {
    let jobs = [], timers = new Map(), nextTimer = 1;
    const fakeGLib = {
        find_program_in_path: () => options.missing ? null : '/usr/bin/ss',
        PRIORITY_DEFAULT: 0, SOURCE_REMOVE: false,
        timeout_add_seconds(priority, seconds, callback) { let id = nextTimer++; timers.set(id, callback); return id; },
        source_remove(id) { timers.delete(id); }
    };
    class Cancellable { cancel() { this.cancelled = true; } }
    const fakeGio = {
        Cancellable, SubprocessFlags: { STDOUT_PIPE: 1, STDERR_PIPE: 2 },
        Subprocess: { new(argv) {
            if (options.spawnError) throw new Error('spawn failed');
            const child = {
                argv, exited: false,
                force_exit() { this.exited = true; },
                communicate_utf8_async(input, cancellable, callback) { jobs.push({ child: this, callback, cancellable }); },
                communicate_utf8_finish(result) {
                    if (result.error) throw new Error(result.error);
                    this.success = result.success !== false;
                    return [true, result.stdout || '', result.stderr || ''];
                },
                get_successful() { return this.success; }
            };
            return child;
        } }
    };
    const Class = new Function('imports', scannerSource + '\nreturn TcpScanner;')({ gi: { Gio: fakeGio, GLib: fakeGLib }, parser: Parser });
    const scanner = new Class();
    let replies = [];
    function start() { return scanner.scan((records, error) => replies.push({ records, error })); }
    function complete(index, result = {}) { let job = jobs[index]; job.callback(job.child, result); }
    function timeout() { let entry = Array.from(timers.entries())[0]; timers.delete(entry[0]); entry[1](); }
    return { scanner, jobs, timers, replies, start, complete, timeout };
}
const tcp4 = 'tcp LISTEN 0 128 127.0.0.1:8080 0.0.0.0:* users:(("server",pid=10,fd=3))';
const tcp6 = 'tcp LISTEN 0 128 [::1]:8080 [::]:* users:(("server",pid=10,fd=3))';
let normal = environment();
assert(normal.start() && !normal.start(), 'An active scanner must refuse a second concurrent query');
normal.complete(0, { stdout: tcp4 });
assert(normal.replies.length === 0 && normal.jobs[1].child.argv.includes('-6'),
    'IPv4 completion must start IPv6 without publishing an incomplete snapshot');
normal.complete(1, { stdout: tcp6 });
assert(normal.replies.length === 1 && normal.replies[0].records.length === 2 &&
    normal.replies[0].records[1].family === 'IPv6' && normal.timers.size === 0,
    'Both families must complete exactly once and release the deadline');
let missing = environment({ missing: true });
missing.start();
assert(missing.replies[0].error.code === 'missing-dependency' && missing.jobs.length === 0,
    'Missing ss must finish synchronously without launching a process');
let expired = environment();
expired.start();
expired.timeout();
assert(expired.replies.length === 1 && expired.replies[0].error.code === 'timeout' &&
    expired.jobs[0].child.exited && expired.jobs[0].cancellable.cancelled,
    'Timeout must stop the child and publish exactly one failure');
assert(expired.start(), 'A timeout must allow another scan');
expired.complete(0, { stdout: tcp4 });
assert(expired.replies.length === 1 && expired.jobs.length === 2,
    'A late old reply must not start IPv6 or complete a replacement scan');
expired.complete(1, { stdout: tcp4 });
expired.complete(2, { stdout: tcp6 });
assert(expired.replies.length === 2 && expired.replies[1].records.length === 2,
    'A replacement scan must succeed after an old timed-out reply');
let cancelled = environment();
cancelled.start();
cancelled.scanner.cancel();
cancelled.complete(0, { error: 'Operation cancelled' });
assert(cancelled.replies.length === 0 && cancelled.timers.size === 0 && cancelled.jobs[0].child.exited,
    'Removal cancellation must stop the process and suppress callbacks');
assert(cancelled.start(), 'Cancellation must leave the scanner reusable');
cancelled.scanner.cancel();
let failed6 = environment();
failed6.start();
failed6.complete(0, { stdout: tcp4 });
failed6.complete(1, { success: false, stderr: '  netlink denied  ' });
assert(failed6.replies.length === 1 && failed6.replies[0].records.length === 0 &&
    failed6.replies[0].error.message === 'netlink denied' && failed6.timers.size === 0,
    'IPv6 failure must not publish a full snapshot and must retain stderr diagnostics');
let deadline6 = environment();
deadline6.start();
deadline6.complete(0, { stdout: tcp4 });
deadline6.timeout();
deadline6.complete(1, { stdout: tcp6 });
assert(deadline6.replies.length === 1 && deadline6.replies[0].error.code === 'timeout' && deadline6.jobs[1].child.exited,
    'The deadline must also stop IPv6 and ignore its late success');
let spawn = environment({ spawnError: true });
spawn.start();
assert(spawn.replies[0].error.message === 'spawn failed' && spawn.timers.size === 0,
    'Process creation errors must release the deadline and report their cause');
let read = environment();
read.start();
read.complete(0, { error: 'invalid UTF-8' });
assert(read.replies[0].error.message === 'invalid UTF-8' && read.timers.size === 0,
    'Communication errors must release the deadline and report their cause');
print('scanner-async-tests: PASS');
