#!/usr/bin/cjs
// Use a controlled ss executable with real Gio subprocesses and a GLib loop.
// No host socket metadata or network access is needed for this integration test.
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
imports.searchPath.unshift(GLib.get_current_dir() + '/port-radar@pedropaulo/lib');
const Scanner = imports.scanner;
function check(condition, message) { if (!condition) throw new Error(message); }
const directory = GLib.dir_make_tmp('port-radar-scanner-XXXXXX');
const executable = directory + '/ss';
const originalPath = GLib.getenv('PATH');
const scanner = new Scanner.TcpScanner();
function installFixture(failIPv6) {
    const ipv6 = failIPv6
        ? "printf '%s\\n' 'controlled IPv6 failure' >&2\nexit 7"
        : "printf '%s\\n' 'tcp LISTEN 0 128 [::1]:8080 [::]:* users:((\"server\",pid=10,fd=3))'";
    GLib.file_set_contents(executable, '#!/bin/sh\ncase "$*" in\n*" -6")\n' + ipv6 +
        '\n;;\n*" -4")\nprintf \'%s\\n\' \'tcp LISTEN 0 128 127.0.0.1:8080 0.0.0.0:* users:(("server",pid=10,fd=3))\'\n;;\n*) exit 9 ;;\nesac\n');
    Gio.File.new_for_path(executable).set_attribute_uint32('unix::mode', 0o700, Gio.FileQueryInfoFlags.NONE, null);
}
function scan() {
    const loop = new GLib.MainLoop(null, false);
    let reply = null, expired = false;
    let watchdog = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 3, () => {
        expired = true;
        scanner.cancel();
        loop.quit();
        return GLib.SOURCE_REMOVE;
    });
    scanner.scan((records, error) => { reply = { records, error }; loop.quit(); });
    if (!reply) loop.run();
    if (!expired) GLib.source_remove(watchdog);
    check(!expired && reply !== null, 'Real subprocess communication must finish before the watchdog');
    return reply;
}
try {
    GLib.setenv('PATH', directory + ':' + (originalPath || '/usr/bin:/bin'), true);
    installFixture(false);
    let result = scan();
    check(!result.error && result.records.length === 2 && result.records[0].address === '127.0.0.1' &&
        result.records[1].family === 'IPv6', 'Real communication must parse and combine both families');
    installFixture(true);
    result = scan();
    check(result.records.length === 0 && result.error.code === 'scan-failed' &&
        result.error.message === 'controlled IPv6 failure', 'Real nonzero exit must retain stderr and reject an incomplete snapshot');
    installFixture(false);
    result = scan();
    check(!result.error && result.records.length === 2, 'A real scanner must recover on the next query after a child failure');
    print('scanner-integration-tests: PASS');
} finally {
    scanner.cancel();
    if (originalPath === null) GLib.unsetenv('PATH');
    else GLib.setenv('PATH', originalPath, true);
    const file = Gio.File.new_for_path(executable);
    if (file.query_exists(null)) file.delete(null);
    Gio.File.new_for_path(directory).delete(null);
}
