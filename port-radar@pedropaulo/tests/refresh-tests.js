#!/usr/bin/cjs
const GLib = imports.gi.GLib;
const ByteArray = imports.byteArray;
const root = GLib.get_current_dir() + '/port-radar@pedropaulo';
let loggedErrors = [];
const bindings = {
    ui: { applet: { TextIconApplet: class {} }, popupMenu: {}, settings: {} },
    mainloop: {}, lang: { bind: (object, callback) => callback.bind(object) },
    gi: { GLib, St: {} }, misc: { config: { PACKAGE_VERSION: '6.6.9' } },
    gettext: { bindtextdomain() {}, dgettext: (domain, text) => text }
};
const source = ByteArray.toString(GLib.file_get_contents(root + '/applet.js')[1]);
const AppletClass = new Function('imports', 'global', source + '\nreturn PortRadarApplet;')(
    bindings, { logError: error => loggedErrors.push(error) });
const applet = Object.create(AppletClass.prototype);
function check(condition, message) {
    if (!condition)
        throw new Error(message);
}
let callbacks = [];
let renders = 0;
Object.assign(applet, {
    _destroyed: false, _scanInProgress: false, _refreshPending: false,
    _compatible: true, _records: [], _changes: [], _hasSnapshot: true,
    _status: { label: { set_text() {} }, actor: { add_style_class_name() {}, remove_style_class_name() {} } },
    _scanner: { scan(callback) { callbacks.push(callback); return true; } },
    _compareSnapshots() { throw new Error('Simulated history failure'); },
    _updatePanelLabel() {}, _render() { renders++; }
});
const record = { address: '127.0.0.1', processes: [] };
applet.refresh();
applet.refresh();
check(callbacks.length === 1, 'An active scan must not run twice');
callbacks[0]([record], null);
check(applet._records[0] === record && renders === 1, 'A history error must not block fresh results');
check(loggedErrors.length === 1, 'History errors should remain diagnosable');
check(callbacks.length === 2, 'Refresh requested during a scan must run afterwards');
applet._compareSnapshots = () => [];
callbacks[1]([], null);
check(applet._records.length === 0 && !applet._scanInProgress, 'A subsequent scan must update normally');
check(applet._lastUpdated, 'A successful scan should record its time');
check(applet._processLabel(record) === '127.0.0.1', 'Missing process data should show the address');
check(applet._processLabel({ processes: [{ pid: 42 }], processName: 'server' }) === 'server', 'Available process names must be preserved');
applet.menu = { isOpen: false, toggle() { this.isOpen = !this.isOpen; } };
applet.on_applet_clicked();
check(callbacks.length === 3, 'Opening the menu should refresh it');
applet.on_applet_clicked();
check(callbacks.length === 3, 'Closing the menu should not start another scan');
const ipv4 = { protocol: 'TCP', port: 8080, family: 'IPv4' };
const ipv6 = { protocol: 'TCP', port: 8080, family: 'IPv6' };
const udp = { protocol: 'UDP', port: 8080, family: 'IPv4' };
let grouped = applet._groupPorts([ipv4, ipv6, udp]);
check(grouped.length === 2 && grouped[0].records.length === 2,
    'IPv4/IPv6 share one port entry, while TCP and UDP remain separate');
applet._records = [ipv4, ipv6, udp];
applet.showUdp = false;
applet.showIpv6 = false;
check(applet._enabledRecords().length === 1, 'Panel count must respect protocol and family settings');
let panelLabel;
applet.set_applet_label = text => { panelLabel = text; };
applet.set_applet_tooltip = () => {};
applet.showCount = true;
applet._scanError = null;
String.prototype.format = imports.format.format;
AppletClass.prototype._updatePanelLabel.call(applet);
check(panelLabel === '1', 'Panel counts grouped ports instead of sockets');
// A failed query must retain the snapshot but expose the error without a counter.
let tooltip;
applet.set_applet_tooltip = text => { tooltip = text; };
applet.showCount = false;
callbacks[2]([], { code: 'scan-failed', message: 'netlink permission denied' });
AppletClass.prototype._updatePanelLabel.call(applet);
check(panelLabel === '' && tooltip.includes('Could not read local ports') && !tooltip.includes('ports in use'),
    'A failed scan must not present the old count as current in the tooltip');
check(loggedErrors.some(error => error.message.includes('netlink permission denied')),
    'Scan diagnostics must include the underlying error in the Cinnamon log');
check(applet._records.length === 3, 'An error must preserve the last successful snapshot');
applet.refresh();
callbacks[3]([], null);
AppletClass.prototype._updatePanelLabel.call(applet);
check(!applet._scanError && tooltip.includes('0 ports in use'),
    'A successful retry must clear the error state');
applet.refresh();
// Removing twice must release resources only once, and ignore outstanding replies.
let cancelled = 0, finalized = 0, menuDestroyed = 0;
applet._scanTimer = null;
applet._scanner.cancel = () => { cancelled++; };
applet.settings = { finalize() { finalized++; } };
applet.menu = { close() {}, destroy() { menuDestroyed++; } };
const rendersBeforeRemoval = renders;
applet.on_applet_removed_from_panel();
check(menuDestroyed === 1, 'Removal must destroy the popup attached to Cinnamon');
applet.on_applet_removed_from_panel();
check(cancelled === 1 && finalized === 1 && menuDestroyed === 1,
    'Repeated removal must not finalize or destroy resources twice');
callbacks[4]([record], null);
check(renders === rendersBeforeRemoval, 'A reply after removal must not touch the UI');
print('refresh-tests: PASS');
