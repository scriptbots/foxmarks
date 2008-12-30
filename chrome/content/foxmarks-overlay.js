/* 
 Copyright 2005-2007 Foxmarks Inc.

 foxmarks-overlay.js: implement the foxmarks overlay into the main browser
 window
 */

var foxmarksObserver = {
    observe: function(subject, topic, data) {
        var result = eval(data);
        //ignore component finish messages
        if(result.status == 3)
            return;
        var status = result.status;
        var msg = result.msg || "";
        var complete = status != 1;

        window.XULBrowserWindow.setJSStatus("Foxmarks: " + msg);

        if (complete) {
            setTimeout(foxmarksObserver.clearStatus, status != 0 ? 5000: 1000);
        }
    },
    clearStatus: function() {
        window.XULBrowserWindow.setJSStatus("");
     },
}

function FoxmarksSetKeyboardShortcut(id, key) {
    var element = document.getElementById(id);
    element.setAttribute("key", key);
    element.setAttribute("disabled", key ? false : true);
}

function FoxmarksBrowserLoad() {
    var os = Cc["@mozilla.org/observer-service;1"].
        getService(Ci.nsIObserverService);
    os.addObserver(foxmarksObserver, "foxmarks-service", false);

    FoxmarksSetKeyboardShortcut("SyncNow", gSettings.syncShortcutKey);
    FoxmarksSetKeyboardShortcut("OpenFoxmarksDialog",
        gSettings.openSettingsDialogShortcutKey);
    return;
}

function FoxmarksOnPopupShowing() {
    if (gSettings.hideStatusIcon) {
        document.getElementById("foxmarks-showstatusicon").
            removeAttribute("checked");
    } else {
        document.getElementById("foxmarks-showstatusicon").
            setAttribute("checked", "true");
    }
    return true;
}

function FoxmarksToggleIcon(event) {
    gSettings.hideStatusIcon = !gSettings.hideStatusIcon;
}

function FoxmarksBrowserUnload() {
    var os = Cc["@mozilla.org/observer-service;1"].
        getService(Ci.nsIObserverService);

    try {
        os.removeObserver(foxmarksObserver, "foxmarks-service");
    } catch (e) {
        LogWrite("Warning: removeObserver failed.");
    }
}

window.addEventListener("load", FoxmarksBrowserLoad, false);
window.addEventListener("unload", FoxmarksBrowserUnload, false);

