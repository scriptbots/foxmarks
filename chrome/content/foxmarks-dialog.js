/*
 Copyright 2005-2008 Foxmarks Inc.

 foxmarks-dialog.js: Implements the main foxmarks options dialog.

 */

// TO DO:
// * Use synchronize method for preferences

var dialogMgr = {
    panes: {
        // Status Tab
        status: {
            onSetup: function(mgr){
                var os = Cc["@mozilla.org/observer-service;1"].
                    getService(Ci.nsIObserverService);
                os.addObserver(this, "foxmarks-service", false);
                os.addObserver(this, "foxmarks-statechange", false);
                this.doc = document;
                this.window = window;
                this.updateStatus();
            },
            onUnload: function(){
                var os = Cc["@mozilla.org/observer-service;1"].
                    getService(Ci.nsIObserverService);
                try {
                    os.removeObserver(this, "foxmarks-service");
                    os.removeObserver(this, "foxmarks-statechange");
                } catch (e) {
                    LogWrite("Warning: removeObserver failed.");
                }
            },
            onOK: function(){},
            onCancel: function(){},
            setErrorMessaging: function(addThem,err){
                if(addThem){
                    var box = this.doc.getElementById('errorbox');
                    if(box){
                        box.parentNode.removeChild(box);
                    }
                    box = this.doc.createElement('groupbox');
                    box.setAttribute('width', '50');
                    box.setAttribute('style', 'padding-left: 42px;');
                    
                    var label = this.doc.createElement('label');
                    label.setAttribute('value',
                        MapError(err) +"\n"
                    );
                    label.setAttribute('style',
                        'font-weight: bold; margin-left: -2px;'

                    );
                    box.appendChild(label);
                    var errMessage = MapErrorMessage(err);
                    var errUrl = MapErrorUrl(err);
                    if(errMessage.length > 0){
                        var desc = this.doc.createElement('description');
                        var textNode = this.doc.createTextNode(
                            MapErrorMessage(err)
                        );
                        desc.appendChild(textNode);
                        box.appendChild(desc);
                    }

                    
                    if(errUrl.length > 0){
                        var box2 = this.doc.createElement('vbox');
                        box2.setAttribute('flex', '1');
                        box2.setAttribute('align', 'end');

                        var button = this.doc.createElement('button');
                        button.setAttribute('label',
                        Bundle().GetStringFromName("dialog.status.button")
                        );
                        button.setAttribute('oncommand', 
                            'dialogMgr.panes.status.moreInfo("' + errUrl + '");'
                        );
                        box2.appendChild(button);
                        box.appendChild(box2);
                    }
                    box.setAttribute('id', 'errorbox');
                    this.doc.getElementById('statusbox').appendChild(box);
                   // this.window.sizeToContent();
                } else {
                    var box = this.doc.getElementById('errorbox');
                    if(box){
                        box.parentNode.removeChild(box);
                    }
                    // this.window.sizeToContent();
                }
            },

            observe: function(subject, topic, data) {
                if(topic == "foxmarks-service"){
                    var result = eval(data);
                    switch(result.status){
                        case 1:
                        case 3:
                            this.updateStatus('working');
                            break;
                        case 0:
                            this.updateStatus('ready');
                            break;
                        case 2:
                            this.updateStatus('dirty');
                            break;
                        default:
                            this.updateStatus('error', result.status);
                            break;
                    }
               } else if(topic == "foxmarks-statechange"){
                    switch(data){
                        case 'ready':
                        case 'dirty':
                        case 'working':
                        case 'error':
                            this.updateStatus(data);
                            break;
                    }
               }
            },
            moreInfo: function(err){
                FoxmarksOpenInNewWindow(err);
            },
            updateStatus: function(state, errorStatus){
                if(state === undefined){
                    var foxmarks = Cc["@foxcloud.com/extensions/foxmarks;1"]
                        .getService(Ci.nsIFoxmarksService);
                    state = foxmarks.getState();
                }
                var image = this.doc.getElementById('status-image');
                var text = this.doc.getElementById('status-text');
                if(errorStatus === undefined){
                    errorStatus = gSettings.lastError;
                }
                switch(state){
                    case 'ready':
                        this.setErrorMessaging(false);
                        image.setAttribute('src',
                            "chrome://foxmarks/skin/images/status-good.png");
                        text.setAttribute('value',
                            Bundle().GetStringFromName("dialog.status.good")
                            );
                        break;
                    case 'dirty':
                        this.setErrorMessaging(false);
                        image.setAttribute('src',
                            "chrome://foxmarks/skin/images/status-dirty.png");
                        text.setAttribute('value',
                            Bundle().GetStringFromName("dialog.status.dirty")
                            );
                        break;
                    case 'working':
                        this.setErrorMessaging(false);
                        image.setAttribute('src',
                            "chrome://foxmarks/skin/images/wheel36x28.gif");
                        text.setAttribute('value',
                            Bundle().GetStringFromName("dialog.status.working")
                            );
                        break;
                    case 'error':
                        image.setAttribute('src',
                            "chrome://foxmarks/skin/images/status-bad.png");
                        text.setAttribute('value',
                            Bundle().GetStringFromName("dialog.status.bad")
                            );
                        this.setErrorMessaging(true, errorStatus);
                        break;
                }
            }
        },
        // General Tab
        general: { 
           onSetup: function(mgr){
                this.data = {
                    username: gSettings.username,
                    password: gSettings.passwordNoPrompt,
                    rememberPassword: gSettings.rememberPassword,
                    synchOnTimer: gSettings.synchOnTimer,
                    syncOnShutdown: gSettings.syncOnShutdown,
                    syncOnShutdownAsk: gSettings.syncOnShutdownAsk,
                };
                // Settings that are too complex to handle via prefwindow
                document.getElementById("password").value =
                    gSettings.passwordNoPrompt;
                document.getElementById("synconshutdown").checked =
                    gSettings.syncOnShutdown;
                document.getElementById("askfirst").checked =
                    gSettings.syncOnShutdownAsk;
                this.syncOnShutdownChanged();
           },
           resetNameAndPassword: function(){
                document.getElementById("username").value =
                    gSettings.username;
                document.getElementById("password").value =
                    gSettings.passwordNoPrompt;

           },
           onOK: function(){
                gSettings.password = 
                    document.getElementById("password").value;
                gSettings.username = 
                    document.getElementById("username").value;
           },

           onCancel: function(){
                var name;
                for(name in this.data){
                    if(this.data.hasOwnProperty(name)){
                        gSettings[name] = this.data[name];
                    }
                }
           },
           forgotPassword: function(){
                FoxmarksOpenInNewWindow("http://" + gSettings.acctMgrHost + 
                        "/login/forgot_password");
           },
           syncOnShutdownChanged: function() {
                document.getElementById("askfirst").disabled =
                    !document.getElementById("synconshutdown").checked;
           },
           syncOnShutdownToPreference: function() {
                if (document.getElementById("synconshutdown").checked) {
                    return 1;
                }
                return 0;
           }
        },
        sync: { // sync tab
           onSetup: function(mgr){
            this.mgr = mgr;

            this.resetSyncTypes();
           },
           
           resetSyncTypes: function(){
            this.data = {
               bookmarks: gSettings.isSyncEnabled("bookmarks"),
               passwords: gSettings.isSyncEnabled("passwords")
            };
            // Settings for passwords
            var passwordSyncEnabled = gSettings.isSyncEnabled("passwords");

            document.getElementById("sync-passwords").checked =
                passwordSyncEnabled;
            document.getElementById("sync-resetpin").disabled =
                !passwordSyncEnabled; 
            document.getElementById("sync-deletepasswords").disabled =
                !passwordSyncEnabled;
            if(gSettings.useOwnServer){
                document.getElementById("sync-deletepasswords").disabled = true;
            }
                
            document.getElementById("sync-bookmarks").checked =
                gSettings.isSyncEnabled("bookmarks");

            if ("@mozilla.org/login-manager;1" in Cc) {
                document.getElementById("onlyFF3").hidden = true;
            }
            else {
                document.getElementById("sync-resetpin").disabled = true;
                document.getElementById("sync-deletepasswords").disabled = true;
                document.getElementById("sync-passwords").disabled = true;
            }

           },
           onOK: function(){

           },
           onCancel: function(){
                gSettings.setSyncEnabled("passwords",this.data.passwords); 
                gSettings.setSyncEnabled("bookmarks",this.data.bookmarks); 
           },
           handlePasswordSync: function(){
                var d = document;
                var passwordSyncEnabled =
                    d.getElementById("sync-passwords").checked; 
                var result = {
                    doSync: false
                };
                if(passwordSyncEnabled){
                        window.openDialog(
                            "chrome://foxmarks/content/foxmarks-setup.xul",
                            "Foxmarks", "chrome,dialog,modal,centerscreen",
                            true,
                            "askforPIN",
                            result
                        );
                        passwordSyncEnabled = gSettings.pinNoPrompt != null;
                        if(!passwordSyncEnabled){
                            d.getElementById("sync-passwords").checked = false; 
                        }
                        if(result.doSync){
                            gSettings.setSyncEnabled("passwords",
                                passwordSyncEnabled);
                            if(gSettings.securityLevel == -1){
                                FoxmarksAlert(Bundle().GetStringFromName
                                    ("msg.resetpin.securitylevelchange"));
                            }
                            gSettings.securityLevel = 1;
                            d.getElementById("encrypt").setAttribute(
                                "value", "1");
                            if(this.mgr.synchronizeNow()){
                                var prefwindow = 
                                    document.getElementById("foxmarks-settings");
                                prefwindow.showPane(
                                    document.getElementById("foxmarks-mainpane")
                                );
                            }
                        }
                }
                else if(!passwordSyncEnabled){
                    gSettings.removePIN();
                }

                gSettings.setSyncEnabled("passwords",passwordSyncEnabled); 
                d.getElementById("sync-deletepasswords").disabled =
                    !passwordSyncEnabled; 
                d.getElementById("sync-resetpin").disabled =
                    !passwordSyncEnabled; 
           },
           handleBookmarkSync: function(){
                var d = document;
                var enabled =d.getElementById("sync-bookmarks").checked; 

                gSettings.setSyncEnabled("bookmarks",enabled); 
           },
           doDeletePasswords: function(){
                var ps = Components.classes
                    ["@mozilla.org/embedcomp/prompt-service;1"]
                    .getService(Components.interfaces.nsIPromptService);
               if(ps.confirm(null,"Foxmarks Bookmark Synchronizer", Bundle().
                    GetStringFromName("msg.deletepasswords.confirm"))
               ){
                    this.mgr.onOK();
                    if(!PerformAction("deletepasswords", null)){
                        gSettings.setSyncEnabled("passwords", false);
                        document.getElementById("sync-passwords").checked = 
                            false; 
                        document.getElementById("sync-resetpin").disabled =
                            true;
                        document.getElementById("sync-deletepasswords").
                            disabled = true;
                        gSettings.removePIN();
                        ps.alert(null, "Foxmarks Bookmark Synchronizer", Bundle().
                                GetStringFromName("msg.deletepasswords.success")
                        );
                    }
                    else {
                        var prefwindow = 
                            document.getElementById("foxmarks-settings");
                        prefwindow.showPane(
                                document.getElementById("foxmarks-mainpane")
                        );
                    }
               }

           },
           doResetPIN: function(){
                var result = {
                    doSync: false
                };
                window.openDialog(
                    "chrome://foxmarks/content/foxmarks-resetpin.xul",
                    "_blank",
                    "chrome,dialog,modal,centerscreen", result);
                if(result.doSync){
                    gSettings.setSyncEnabled("passwords",true); 
                   gSettings.setMustUpload("passwords", true);
                   if(!this.mgr.synchronizeNow()){
                        FoxmarksAlert(Bundle().
                            GetStringFromName("msg.resetpin.success"));
                   }
                    else {
                        var prefwindow = 
                            document.getElementById("foxmarks-settings");
                        prefwindow.showPane(
                                document.getElementById("foxmarks-mainpane")
                        );
                    }
                }
            },
            moreSyncSoon: function(){
                FoxmarksOpenInNewWindow("http://wiki.foxmarks.com/wiki/Foxmarks:_More_Syncing_Coming_Soon"); 
            }
        },
        profile: { // profiles tab
           onSetup: function(mgr){
                this.mgr = mgr;
                this.settingChanged();
           },
           onOK: function(){

           },

           onCancel: function(){

           },
           myFoxmarks: function(){
                if(gSettings.securityLevel == 1){
                    FoxmarksOpenInNewTab("https://my.foxmarks.com/?mode=profiles", true);
                } else { 
                    FoxmarksOpenInNewTab("http://my.foxmarks.com/?mode=profiles", true);
                }
           },
           changeProfile: function() {
                var retval = {};
                window.openDialog(
                    "chrome://foxmarks/content/foxmarks-changeprofile.xul",
                    "Foxmarks", "modal,centerscreen", retval
                );

                if (retval.newProfileId &&
                    retval.newProfileId != gSettings.viewId) {
                    var ps = Components.
                        classes["@mozilla.org/embedcomp/prompt-service;1"]
                        .getService(Components.interfaces.nsIPromptService);
                    if (ps.confirm(null, "Foxmarks Bookmark Synchronizer",
                        Bundle().GetStringFromName("msg.profilechanged"))) {
                        if (this.mgr.synchronizeNow()) {
                            var prefwindow = 
                                document.getElementById("foxmarks-settings");
                            prefwindow.showPane(
                                document.getElementById("foxmarks-mainpane")
                            );
                            return;
                        }
                        gSettings.viewId = retval.newProfileId;
                        gSettings.viewName = retval.newProfileName;
                        this.mgr.downloadNow(true);
                        this.settingChanged();
                    }
                }
            },
            settingChanged: function() {
                document.getElementById("profileName").value =
                    gSettings.viewName;
            }
        },
        // Advanced tab
        advanced: { 
           onSetup: function(mgr){
                this.data = {
                    enableLogging: gSettings.enableLogging,
                    securityLevel: gSettings.securityLevel,
                    url: gSettings.url,
                    passwordurl: gSettings.passwordurl
                };
                this.useOwnServerChanged();
           },
           verifyOK: function(){
                var uo = document.getElementById("useown").checked;
                if(uo){
                    var s = document.getElementById("url").value;
                    if(s.length == 0){
                        FoxmarksAlert(Bundle().
                            GetStringFromName("error.nourlownserver"));
                        return false;
                    }
                    var exp = /(.*):\/\/([^\/]*)/;
                    var result = s.match(exp);
                    if (!result || result.length < 2) {
                        FoxmarksAlert(Bundle().
                            GetStringFromName("error.nourlownserver"));
                        return false;
                    }
                    gSettings.useOwnServer = uo;
                }

                return true;
           },
           onOK: function(){
                var uo = document.getElementById("useown").checked;
                gSettings.useOwnServer = uo;
           },
           onCancel: function(){
                var name;
                for(name in this.data){
                    if(this.data.hasOwnProperty(name)){
                        gSettings[name] = this.data[name];
                    }
                }
           },
           displayLogFile: function() {
                var ios = Cc["@mozilla.org/network/io-service;1"].
                    getService(Ci.nsIIOService);
                var file = Cc['@mozilla.org/file/directory_service;1']
                    .getService(Ci.nsIProperties) .get('ProfD', Ci.nsIFile);

                file.append("foxmarks.log");
                var uri = ios.newFileURI(file);
                FoxmarksOpenInNewWindow(uri.spec);
           },
          useOwnServerChanged: function() {
                var uo = document.getElementById("useown").checked;
                document.getElementById("url").disabled = !uo;
                document.getElementById("useown-url-label").disabled = !uo;
                document.getElementById("passwordurl").disabled = !uo;
                document.getElementById("useown-passwordurl-label").disabled =
                    !uo;
                document.getElementById("encrypt").disabled = uo;
                document.getElementById("profileChangeButton").disabled = uo;
            },
           moreOwnServer: function(){
                FoxmarksOpenInNewWindow("http://wiki.foxmarks.com/wiki/Foxmarks:_Frequently_Asked_Questions#Using_Other_Servers"); 
           }
        }
    },

    _forEachPane: function(method, args){
        var name;
        for(name in this.panes){
            if(this.panes.hasOwnProperty(name)){
                var pane = this.panes[name];
                if(typeof(method) == "string"){
                    pane[method].apply(pane, args);
                }
                else {
                    if(args === undefined){
                        args = [];

                    }
                    args.splice(0,0,this.panes[name]);
                    method.apply(pane, args);
                }
            }
        }
    },

    onSetup: function(){
        this._forEachPane("onSetup", [this]);

        // Set styles for Mac OS X
        if (navigator.platform.toLowerCase().indexOf('mac') > -1 ||
            navigator.platform.toLowerCase().indexOf('linux') > -1) {
            document.getElementById("foxmarks-settings").className = "macosx";
        }
        // Set server ping
        if (!gSettings.useOwnServer) {
            var attrs = [];
            attrs.push("app="       + "jezebel");
            attrs.push("mid="       + gSettings.machineId);
            attrs.push("page="      + "settings");
            attrs.push("username="  + gSettings.username);
            attrs.push("no_cache="  + Date.now().toString(36));
            var query = attrs.join("&");

            document.getElementById("ping").src = 
                "http://tr.foxmarks.com/tracking/impressions.gif?" + query; 
        }

        // Info that is read-only
        this._lastSyncDateChanged();
        document.getElementById("version").value = 
            "v"
            + FoxmarksVersion();
        try {
            window.sizeToContent();
        } catch(e) {}

        var prefwindow = document.getElementById("foxmarks-settings");
        prefwindow.showPane(
            document.getElementById(window.arguments[0] || "foxmarks-mainpane")
        );

    },
    onOK: function(){
        if(!this.panes.advanced.verifyOK()){
           return false;
        }
        this._forEachPane("onOK");
        return true;
    },
    onCancel: function(){
        if (navigator.platform.toLowerCase().indexOf('mac') > -1 ||
            navigator.platform.toLowerCase().indexOf('linux') > -1) {
            this._forEachPane("onOK");
        }
        else {
            this._forEachPane("onCancel");
        }
        return true;
    },
    onHelp: function(){
        FoxmarksOpenInNewWindow("http://wiki.foxmarks.com/wiki/Foxmarks:_Help");
    },
    runSetupWizard: function(){
        this.onOK();
        if(gSettings.useOwnServer){
            FoxmarksAlert(Bundle().
                GetStringFromName("error.nowizforownserver"));
        } else {
            FoxmarksOpenWizard(true);
            window.close();
        }
    },
    synchronizeNow: function() {
        var retval = 0;
        this.onOK();
        var retval = PerformAction("synch", null);
        this._lastSyncDateChanged();
        this.panes.general.resetNameAndPassword();
        this.panes.sync.resetSyncTypes();
        return retval;
    },
    _lastSyncDateChanged: function() {
        document.getElementById("lastSynchDate").value = 
            gSettings.lastSynchDisplayDate;
    },
    uploadNow: function(){
        var retval = 0;
        var ps = Components.classes
            ["@mozilla.org/embedcomp/prompt-service;1"]
            .getService(Components.interfaces.nsIPromptService);
        if (ps.confirm(null, "Foxmarks Bookmark Synchronizer",
            Bundle().GetStringFromName("msg.overwriteremote"))) {
            this.onOK();
            retval = PerformAction("upload", null);
            if(retval){
               var prefwindow = document.getElementById("foxmarks-settings");
               prefwindow.showPane(
                    document.getElementById("foxmarks-mainpane")
               );
            }
            this._lastSyncDateChanged();
        }
        return retval;
    },
    downloadNow: function(silent){
        var retval = 0;
        var ps = Components.classes
            ["@mozilla.org/embedcomp/prompt-service;1"]
            .getService(Components.interfaces.nsIPromptService);
        if (silent
            || ps.confirm(null, "Foxmarks Bookmark Synchronizer",
                Bundle().GetStringFromName("msg.overwritelocal"))) {
            this.onOK();
            retval = PerformAction("download", null);
            if(retval){
               var prefwindow = document.getElementById("foxmarks-settings");
               prefwindow.showPane(
                    document.getElementById("foxmarks-mainpane")
               );
            }
            this._lastSyncDateChanged();
        }
        return retval;

    },
    onUnload: function(){
        this.panes.status.onUnload();
    }
};



function SynchronizeForever() {
    while (!SynchronizeNow()) { };
}


