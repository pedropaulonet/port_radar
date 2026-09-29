#!/usr/bin/cjs
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
imports.searchPath.unshift('/usr/share/cinnamon/js');
const Loader = imports.misc.fileUtils;
const root = GLib.get_current_dir() + '/port-radar@pedropaulo';
const temporary = GLib.dir_make_tmp('port-radar-imports-XXXXXX');
const stalePath = temporary + '/socket-model.js';
try {
    // CJS keeps legacy imports cached across applet reloads.
    GLib.file_set_contents(stalePath, 'var legacyVersion = true;');
    imports.searchPath.unshift(temporary);
    if (!imports['socket-model'].legacyVersion)
        throw new Error('Could not reproduce a previously cached module');
    const changes = Loader.requireModule('./lib/change-detector', root);
    const record = { protocol: 'TCP', family: 'IPv4', address: '127.0.0.1', port: 8080,
        processes: [], endpointKey: 'TCP|IPv4|127.0.0.1|8080' };
    if (changes.compareSnapshots([], [record])[0].type !== 'opened')
        throw new Error('History failed with a legacy module in the CJS cache');
    print('module-loading-tests: PASS');
} finally {
    Gio.File.new_for_path(stalePath).delete(null);
    Gio.File.new_for_path(temporary).delete(null);
}
