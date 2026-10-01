#!/usr/bin/cjs
// Cinnamon widgets need a running shell; double that boundary only. Execute
// the real applet rendering and actions against parser-produced socket data.
const GLib = imports.gi.GLib;
const ByteArray = imports.byteArray;
imports.searchPath.unshift(GLib.get_current_dir() + '/port-radar@pedropaulo/lib');
const Parser = imports.parser;
String.prototype.format = imports.format.format;
function check(condition, message) { if (!condition) throw new Error(message); }
let rootMenu = null;
const stage = {
    key_focus: null,
    get_key_focus() { return this.key_focus; },
    setFocus(actor) {
        this.key_focus = actor;
        // PopupMenuManager._onKeyFocusChanged closes an open menu when focus
        // is lost or moves outside it, including when a focused actor dies.
        if (rootMenu && rootMenu.isOpen && (!actor || !rootMenu.actor.contains(actor)))
            rootMenu.close();
    }
};
class Actor {
    constructor() { this.visible = true; }
    contains(actor) {
        for (let current = actor; current; current = current.parent)
            if (current === this) return true;
        return false;
    }
    grab_key_focus() { stage.setFocus(this); }
    destroy() { if (this.contains(stage.key_focus)) stage.setFocus(null); }
    show() { this.visible = true; }
    hide() { this.visible = false; }
    add_style_class_name() {}
    remove_style_class_name() {}
}
class Item {
    constructor(text) {
        this.actor = new Actor();
        this.label = { text, set_text(value) { this.text = value; } };
        this.handlers = {};
    }
    connect(name, callback) { this.handlers[name] = callback; }
    destroy() { this.destroyed = true; if (this.menu) this.menu.removeAll(); this.actor.destroy(); }
}
class Menu {
    constructor() { this.actor = new Actor(); this.items = []; this.isOpen = false; this.removals = 0; }
    addMenuItem(item) {
        item.actor.parent = this.actor;
        if (item.menu) item.menu.actor.parent = this.actor;
        this.items.push(item);
    }
    removeAll() { this.items.forEach(item => item.destroy()); this.items = []; this.removals++; }
    open() { this.isOpen = true; }
    close() { this.isOpen = false; }
}
class Submenu extends Item {
    constructor(text) { super(text); this.menu = new Menu(); }
}
let copied = [];
const bindings = {
    ui: { applet: { TextIconApplet: class {} }, popupMenu: {
        PopupMenuItem: Item, PopupSubMenuMenuItem: Submenu, PopupSeparatorMenuItem: Item
    }, settings: {} }, mainloop: {}, lang: { bind: (o, f) => f.bind(o) },
    gi: { GLib, St: { Clipboard: { get_default: () => ({ set_text: (kind, text) => copied.push(text) }) }, ClipboardType: { CLIPBOARD: 1 } } },
    misc: { config: { PACKAGE_VERSION: '6.6.9' } },
    gettext: { bindtextdomain() {}, dgettext: (domain, text) => text }
};
const source = ByteArray.toString(GLib.file_get_contents(GLib.get_current_dir() + '/port-radar@pedropaulo/applet.js')[1]);
const AppletClass = new Function('imports', 'global', source + '\nreturn PortRadarApplet;')(bindings, { stage });
const applet = Object.create(AppletClass.prototype);
function record(address, pid = 10) {
    return Parser.parseSsOutput('tcp LISTEN 0 128 ' + address + ':8080 0.0.0.0:* users:(("server",pid=' + pid + ',fd=3))')[0];
}
Object.assign(applet, {
    _destroyed: false, _scanInProgress: false, _scanError: null,
    _records: [record('127.0.0.1')], _changes: [], _lastUpdated: null,
    _filter: 'all', showUdp: true, showIpv6: true, maxEntries: 50,
    _status: new Item(''), _updated: new Item(''), _changesItem: new Submenu(''),
    _socketSection: new Menu(), _changesSection: new Menu(),
    _socketItems: new Map(), _searchEntry: { get_text: () => '' }
});
rootMenu = new Menu();
applet.menu = rootMenu;
applet._socketSection.actor.parent = rootMenu.actor;
applet._changesSection.actor.parent = rootMenu.actor;
applet._render();
rootMenu.open();
let first = applet._socketSection.items[0];
first.menu.open();
applet._render();
check(applet._socketSection.items[0] === first && !first.destroyed && first.menu.isOpen,
    'An unchanged snapshot must retain the open widget and its navigation state');
first.menu.items[1].actor.grab_key_focus();
applet._records = [record('0.0.0.0')];
applet._render();
check(rootMenu.isOpen, 'A refresh must not close the root menu when replacing a focused socket detail');
let changed = applet._socketSection.items[0];
check(changed.menu.isOpen, 'A changed port must keep its details expanded');
check(changed.menu.items.some(item => item.label.text.includes('0.0.0.0')),
    'Preserving the submenu must not preserve stale address details');
changed.actor.grab_key_focus();
applet._records = [];
applet._render();
check(rootMenu.isOpen, 'Closing a focused port must not close the root menu');
check(!applet._socketSection.items.some(item => item instanceof Submenu),
    'A closed port must disappear even when its details were expanded');
applet._records = [record('127.0.0.1')];
applet._render();
check(!applet._socketSection.items[0].menu.isOpen, 'A reopened port must not inherit stale expansion state');
let details = applet._socketSection.items[0].menu.items;
let copyPort = details.find(item => item.label.text === 'Copy port');
check(copyPort && copyPort.handlers.activate, 'Port details must expose a copy-port action');
copyPort.handlers.activate();
let copyAddress = details.find(item => item.label.text.startsWith('Copy address:'));
check(copyAddress && copyAddress.handlers.activate, 'Address details must expose a copy-address action');
copyAddress.handlers.activate();
let copyPid = details.find(item => item.label.text === 'Copy PID: 10');
check(copyPid && copyPid.handlers.activate, 'Known process details must expose a copy-PID action');
copyPid.handlers.activate();
check(JSON.stringify(copied) === '["8080","127.0.0.1","10"]',
    'Clipboard actions must copy raw values rather than formatted labels');
applet._records = Parser.parseSsOutput('tcp LISTEN 0 128 [fe80::1]%eth0:8080 [::]:*', 'IPv6');
applet._render();
details = applet._socketSection.items[0].menu.items;
check(!details.some(item => item.label.text.startsWith('Copy PID:')), 'Missing owners must not offer a fabricated PID');
details.find(item => item.label.text.startsWith('Copy address:')).handlers.activate();
check(copied[3] === 'fe80::1%eth0', 'Copying an IPv6 address must preserve the interface scope');
// The empty-state message must follow enabled totals even when no rows match.
applet._searchEntry.get_text = () => 'no-match';
applet._records = [];
applet._render();
check(applet._socketSection.items[0].label.text === 'No local sockets detected', 'An empty snapshot must explain absence of sockets');
applet._records = [record('127.0.0.1')];
applet._render();
check(applet._socketSection.items[0].label.text === 'No sockets match this search and filter',
    'An unchanged empty search result must update its explanation when sockets appear');
applet._changes = [{ type: 'opened', record: record('127.0.0.1') }];
applet._render();
applet._changesSection.items[0].actor.grab_key_focus();
applet._render();
check(rootMenu.isOpen, 'Rebuilding focused history entries must keep the root menu open even when sockets are unchanged');
applet._searchEntry.get_text = () => '';
applet._render();
applet._socketSection.items[0].menu.items[0].actor.grab_key_focus();
applet._scanError = 'scan-failed';
applet._render();
check(rootMenu.isOpen && applet._socketSection.items.length === 0,
    'A scan error must clear focused results without closing the root menu');
rootMenu.close();
applet._scanError = null;
applet._render();
check(!rootMenu.isOpen, 'A refresh must not reopen a menu the user has closed');
print('ui-tests: PASS');
