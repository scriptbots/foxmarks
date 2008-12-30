/* 
 Copyright 2007 Foxmarks Inc.

 foxmarks-statusbar.js: implement the foxmarks status bar
 */

if (typeof(Cc) == "undefined") var Cc = Components.classes;
if (typeof(Ci) == "undefined") var Ci = Components.interfaces;

var STATE_MAP = {
    ready: { src: "chrome://foxmarks/skin/images/ready.png", 
        tooltip: "icon.tooltip.ready" },
    dirty: { src: "chrome://foxmarks/skin/images/dirty.png",
        tooltip: "icon.tooltip.dirty" },
    working: { src: "chrome://foxmarks/skin/images/wheel_16.gif",
        tooltip: "icon.tooltip.working" },
    error: { src: "chrome://foxmarks/skin/images/error.png",
        tooltip: "icon.tooltip.error" }
};


function FoxmarksQuietSync() {
    var foxmarks = Cc["@foxcloud.com/extensions/foxmarks;1"]
        .getService(Ci.nsIFoxmarksService);

    foxmarks.synchronize();
}

var stateObserver = {
    observe: function(subject, topic, data) {
        UpdateStateIndicator(data);
    }
}

function UpdateStateIndicator(state) {
    if (state == "hide" || state == "show") {
        UpdateHiddenState();
    } else {
        var panel = document.getElementById("foxmarks-statusimage");
        panel.src = STATE_MAP[state].src;
        panel.tooltipText = Cc["@mozilla.org/intl/stringbundle;1"].
            getService(Ci.nsIStringBundleService).
            createBundle("chrome://foxmarks/locale/foxmarks.properties").
            GetStringFromName(STATE_MAP[state].tooltip);
    }
}


function UpdateHiddenState(state) {
    if (state == null) {
        state = gSettings.hideStatusIcon;
    } else {
        gSettings.hideStatusIcon = state;
    }
    document.getElementById("foxmarks-statusbarpanel").hidden = state;
}

function StatusBarLoad() {
    var os = Cc["@mozilla.org/observer-service;1"].
        getService(Ci.nsIObserverService);
    os.addObserver(stateObserver, "foxmarks-statechange", false);

    var foxmarks = Cc["@foxcloud.com/extensions/foxmarks;1"]
        .getService(Ci.nsIFoxmarksService);
    var state = foxmarks.getState();
    UpdateStateIndicator(state);
    UpdateHiddenState();

    return;
}

function StatusBarUnload() {
    var os = Cc["@mozilla.org/observer-service;1"].
        getService(Ci.nsIObserverService);

    try {
        os.removeObserver(stateObserver, "foxmarks-statechange");
    } catch (e) {
        LogWrite("Warning: removeObserver failed.");
    }
}

window.addEventListener("load", StatusBarLoad, false);
window.addEventListener("unload", StatusBarUnload, false);
