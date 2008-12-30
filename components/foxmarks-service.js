/*
 Copyright 2005-2008 Foxmarks Inc.

 foxmarks-service.js: component that implements the "service" interface to
 the core synchronization code.

 */

var Cc = Components.classes;
var Ci = Components.interfaces;

function LoadJavascript(filename, id) {
    if (id == "undefined") {
        Cc["@mozilla.org/moz/jssubscript-loader;1"].
        getService(Ci.mozIJSSubScriptLoader).
        loadSubScript(filename, null);
    }
}

function GetTopWin(wintype) {
    var topwin = Cc['@mozilla.org/appshell/window-mediator;1'].
        getService(Ci.nsIWindowMediator).
        getMostRecentWindow(wintype);

    return topwin;
}


function FoxmarksLaunchUpgradePage() {
    upgradeCallback.timer = Cc["@mozilla.org/timer;1"].
        createInstance(Ci.nsITimer);
    upgradeCallback.timer.initWithCallback(upgradeCallback, 5000,
        Ci.nsITimer.TYPE_ONE_SHOT);
}

function FoxmarksBuildPostData(num_bookmarks){
    return {
        username: gSettings.username,
        version: FoxmarksVersion(),
        types: {
            bookmarks: {
                is_enabled: gSettings.isSyncEnabled("bookmarks"),
                count: num_bookmarks
            },
            passwords: {
                is_enabled: gSettings.isSyncEnabled("passwords")
            }
        }
    };
}
var upgradeCallback = {
    notify: function(timer) {
        FoxmarksSyncService.server.countItems("bookmarks",
            "bookmark", function(status, num_bookmarks){
            var currver = FoxmarksVersion();
            var wm = Cc['@mozilla.org/appshell/window-mediator;1'].
                getService(Ci.nsIWindowMediator);
            var topWindow = wm.getMostRecentWindow('navigator:browser');

            if(topWindow &&
                topWindow.document){ 
                var appcontent =
                    topWindow.document.getElementById("appcontent");
                var listener = function(e){
                    var doc = e.originalTarget;
                    var button = 
                        doc.getElementById(
                        "set_up_password_sync_button"
                    );

                    if(button){
                        button.setAttribute("onclick",  null);
                        button.addEventListener(
                            "click",
                            function(){
                                var os = Cc["@mozilla.org/observer-service;1"].
                                    getService(Ci.nsIObserverService);
                                os.notifyObservers(null, 
                                    "foxmarks-showsettingpane", 
                                    "foxmarks-syncpane"
                                );
                            }, 
                            true
                        );
                        appcontent.removeEventListener(
                            "DOMContentLoaded",
                            listener, 
                            false
                        );
                    }
                };
                if(appcontent){
                    appcontent.addEventListener(
                        "DOMContentLoaded",
                        listener, 
                        false
                    );
                }
            }
            FoxmarksOpenInNewTab(gSettings.httpProtocol + gSettings.webHost + "/firefox/upgrade/" + currver, 
                true, FoxmarksBuildPostData(num_bookmarks));
            gSettings.currVersion = currver;
        });
    }
}
function FoxmarksLaunchSetupWizard() {
    wizardCallback.timer = Cc["@mozilla.org/timer;1"].
        createInstance(Ci.nsITimer);
    wizardCallback.timer.initWithCallback(wizardCallback, 5000,
        Ci.nsITimer.TYPE_ONE_SHOT);
}

var wizardCallback = {
    notify: function(timer) {
        FoxmarksOpenWizard(false, gSettings.username != "");
    }
}

function HandleShutdown(cancel) {
    var retval = { helpurl: null };
    var sb = Bundle().GetStringFromName;
    var dontask = {value: false};
    var rv = 0;

    if (!gSettings.haveSynced || GetState() != "dirty") {
        return;
    }

    var topwin = GetTopWin();

    if (!topwin) {
        LogWrite("HandleShutdown: Couldn't find a topwin!");
        return;
    }

    if (gSettings.syncOnShutdown && gSettings.syncOnShutdownAsk) {

        rv = Cc["@mozilla.org/embedcomp/prompt-service;1"].
        getService(Ci.nsIPromptService).
        confirmEx(topwin, sb("appname.long"), sb("msg.unsynced"),
            Ci.nsIPromptService.STD_YES_NO_BUTTONS, null, null, null,
            sb("msg.dontask"), dontask);
        // Reverse sense: confirmEx returns 0 - yes, 1 - no
        rv = !rv;

        // If user says "don't ask me again", set syncOnShutdown to whatever
        // they have chosen in this instance.
        if (dontask.value) {
            gSettings.syncOnShutdown = rv;
        }
        gSettings.syncOnShutdownAsk = !dontask.value;

    } else {                           // don't ask
        rv = gSettings.syncOnShutdown;
    }

    if (rv) {
        var win = topwin.openDialog(
            "chrome://foxmarks/content/foxmarks-progress.xul", "_blank",
            "chrome,dialog,modal,centerscreen", "synch", retval, null);
        if (retval.helpurl) { // we hit an error and user pressed help button
            if (cancel instanceof Ci.nsISupportsPRBoolean) {
                cancel.value = true;
                topwin.openDialog("chrome://browser/content/browser.xul",
                    "_blank", "chrome,all,dialog=no", retval.helpurl);
            }
        }
    }
}

function LoadFiles() {
    LoadJavascript("chrome://foxmarks/content/foxmarks-log.js",
        typeof(LogWrite));
    LoadJavascript("chrome://foxmarks/content/foxmarks-settings.js",
        typeof(gSettings));
    LoadJavascript("chrome://foxmarks/content/foxmarks-update.js",
        typeof(ForceUpdate));
    LoadJavascript("chrome://foxmarks/content/foxmarks-clobber.js",
        typeof(onClobberCancel));
    LoadJavascript("chrome://foxmarks/content/foxmarks-bookmark.js",
        typeof(loadDatasourceSet));
    if ("@mozilla.org/browser/nav-bookmarks-service;1" in Cc)
        LoadJavascript("chrome://foxmarks/content/foxmarks-places.js",
            typeof(BookmarkDatasource));
    else
        LoadJavascript("chrome://foxmarks/content/foxmarks-rdf.js",
            typeof(BookmarkDatasource));
    LoadJavascript("chrome://foxmarks/content/foxmarks-nodes.js",
        typeof(Node));
    LoadJavascript("chrome://foxmarks/content/foxmarks-command.js",
        typeof(Command));
    LoadJavascript("chrome://foxmarks/content/foxmarks-core.js",
        typeof(Synchronize));
    LoadJavascript("chrome://foxmarks/content/foxmarks-network.js",
        typeof(Request));
    LoadJavascript("chrome://foxmarks/content/foxmarks-json.js",
        "undefined");

    LoadJavascript("chrome://foxmarks/content/shared/Base64.js",
        typeof(Base64));
    LoadJavascript("chrome://foxmarks/content/shared/CreateAESManager.js",
        typeof(CreateAESManager));
    LoadJavascript("chrome://foxmarks/content/foxmarks-utils.js",
        typeof(forEach));
    LoadJavascript("chrome://foxmarks/content/foxmarks-unittest.js",
        typeof(gFoxmarksUT));
    LoadJavascript("chrome://foxmarks/content/foxmarks-uitools.js",
        typeof(FoxmarksOpenWindowByType));
    if("@mozilla.org/login-manager;1" in Cc){
        LoadJavascript("chrome://foxmarks/content/foxmarks-password.js",
            typeof(PasswordDatasource));
    }
    LoadJavascript("chrome://foxmarks/content/foxmarks-server.js",
        typeof(SyncServer));
}

var logStream = null;
 
function removeTempLogFile(){
    var fileremoved = Cc['@mozilla.org/file/directory_service;1']
        .getService(Ci.nsIProperties)
        .get('ProfD', Ci.nsIFile);
    fileremoved.append("foxmarks.temp.log");
    try {
        fileremoved.remove(false);
    } catch(e){}
}
function logMoveFile(){
    try {
        var file = Cc['@mozilla.org/file/directory_service;1']
            .getService(Ci.nsIProperties)
            .get('ProfD', Ci.nsIFile);
        file.append("foxmarks.log");

        var dir = Cc['@mozilla.org/file/directory_service;1']
            .getService(Ci.nsIProperties)
            .get('ProfD', Ci.nsIFile);
        removeTempLogFile();
        file.moveTo(dir, "foxmarks.temp.log");


        var fromstream = Cc["@mozilla.org/network/file-input-stream;1"]
            .createInstance(Ci.nsIFileInputStream);
        var tostream = Cc["@mozilla.org/network/file-output-stream;1"]
            .createInstance(Ci.nsIFileOutputStream);

        fromstream.init(file, -1, 0x01, 0);
        var logSeek = fromstream.QueryInterface(Ci.nsISeekableStream);
        var lread = fromstream.QueryInterface(Ci.nsILineInputStream);
        var converter = Cc["@mozilla.org/intl/scriptableunicodeconverter"]
            .createInstance(Ci.nsIScriptableUnicodeConverter);
        converter.charset = "UTF-8";
        var i =  100 * 1024;
        if(i > file.fileSize){
            i = file.fileSize;
        }

        var filenew = Cc['@mozilla.org/file/directory_service;1']
            .getService(Ci.nsIProperties)
            .get('ProfD', Ci.nsIFile);
        filenew.append("foxmarks.log");
        tostream.init(filenew, 0x02 | 0x08 | 0x10, 0664, 0);

        logSeek.seek(logSeek.NS_SEEK_END, -i);

        var buf;
        var cont = true;
        var lineData = {};
        var ctr = 0;
        // throw out the first one; could be mid line
        cont = lread.readLine(lineData);
        while(cont){
            lineData = {};
            cont = lread.readLine(lineData);
            buf = converter.ConvertToUnicode(lineData.value) + "\n";
            tostream.write(buf, buf.length);
        }

     } catch(e){
        Components.utils.reportError(e);
     } finally {
        if(fromstream !== undefined)
            fromstream.close();
        if(tostream !== undefined)
            tostream.close();
     }
    removeTempLogFile();
}
function logFileOpen() {
    var file = Cc['@mozilla.org/file/directory_service;1']
    .getService(Ci.nsIProperties)
    .get('ProfD', Ci.nsIFile);

    var needsTruncate = false;
    var filesize = 0;
    file.append("foxmarks.log");

    // check the file size
    try {
       if(file.isFile()){
            filesize = file.fileSize;
       }

       if(filesize > 500 * 1024 && gSettings.truncateLog ){
            logMoveFile();
       }
    } catch(e) {
        Components.utils.reportError(e);
    }
    
    try {
        logStream = Cc["@mozilla.org/network/file-output-stream;1"]
        .createInstance(Ci.nsIFileOutputStream);

        // use write, append, create
        logStream.init(file, 0x02 | 0x08 | 0x10, 0664, 0);
    } catch (e) {
        // We failed to open. Close and try again next time.
        logFileClose();
    }
}

function logFileClose() {
    try {
        logStream.close();
    } catch (e) {}
    logStream = null;
}

var gFailureCount = 0;// number of consecutive times we've failed
var gBackoffUntil = 0;// if we've been failing, our backoff time (ms since 1970)
var gServerBackoff = 
    { 'bookmarks': 0,
      'passwords': 0,
      min: function(){
        return Math.min(this['bookmarks'], this['passwords']);
      },
      max: function(){
        return Math.max(this['bookmarks'], this['passwords']);
      },
      clear: function(){
        this['bookmarks'] = 0;
        this['passwords'] = 0;
      }
    };  // seconds server wants us to back off

function ReturnErrorMsg(code, msg, restoreState) {
    gSettings.lastError  = code;
    Notify({status: code, msg: msg });
    ClearBusy();
    SetState(restoreState ? restoreState : ((code == 503 || code == 2)
            ? "dirty" : "error"));
    LogWrite("Returned error: " + msg + "(" + code + ")");
    if(code != 2){
        var d = new Date();
        // Initial back-off is 15 minutes, doubling with each error
        gBackoffUntil = d.getTime() + 1000 * (Math.max(
            15 * 60 * Math.pow(2, gFailureCount++),
            gServerBackoff.max()) + Math.floor(Math.random() * 15));
        gServerBackoff.clear();;
        var retry = new Date();
        retry.setTime(gBackoffUntil);
        LogWrite("Will retry at " + retry);
    }
    FoxmarksSyncService.lastError = code;
}

function ReturnErrorCode(code) {
    ReturnErrorMsg(code, MapError(code));
}

function ReturnSuccess(msgname, args, restoreState) {
    if (args == null) {
        var args = {};
    }

    args.status = 0;
    args.msg = Bundle().GetStringFromName(msgname);

    SetState(restoreState ? restoreState : "ready");
    ClearBusy();
    gFailureCount = 0;
    FoxmarksSyncService.lastError = 0;
    LogWrite("Success: " + Bundle().GetStringFromName(msgname));
    Notify(args);
}

function SetBusy() {
    if (IsBusy._busy) {
        return false;
    } else {
        IsBusy._busy = true;
        SetState("working");
        return true;
    }
}

function ClearBusy() {
    IsBusy._busy = false;
}

function IsBusy() {
    return IsBusy._busy;
}
IsBusy._busy = false;

function GetState() {
    return GetState._state;
}
GetState._state = "ready";

function SetState(newstate) {
    if (newstate == GetState()) {
        return;
    }

    var os = Cc["@mozilla.org/observer-service;1"]
    .getService(Ci.nsIObserverService);

    os.notifyObservers(null, "foxmarks-statechange", newstate);

    GetState._state = newstate;
}

// Internal callbacks

function LogStart(op, dest) {
    LogWrite("------ Foxmarks/" + FoxmarksVersion() + " (" + 
            FoxmarksSyncService.getStorageEngine("bookmarks") + ") starting " + op +
            " with " + dest + " ------");
}

///////////////////////////////////////////////////////////////////////////
//
// nsFoxmarksService
//

var FoxmarksSyncService = null;  // set during initialization to instance object

function nsFoxmarksService() {
    LoadFiles();
}

nsFoxmarksService.prototype = {
    /////////////////////////////////////////////////////////////////////////
    // nsIFoxmarksService

    timer: null,
    _server: null,
    lastmodified: null,

    status: function(syncType) {
        // return if we're currently processing another request
        if (!SetBusy()) {
            return false;
        }
        LogStart("status", gSettings.host);
        if(syncType === undefined)
            syncType = "bookmarks";

        this.server.status(syncType, function(status, response){
            if (status) {
                ReturnErrorCode(status);
            }
            else {
                ReturnSuccess("msg.accountverified", response);
            }
        });
        return true;
    },
    extstatus: function(syncType) {
        // return if we're currently processing another request
        if (!SetBusy()) {
            return false;
        }
        LogStart("extstatus", gSettings.host);
        if(syncType === undefined)
            syncType = "bookmarks";

        this.server.extstatus(syncType, function(status, response){
            if (status) {
                ReturnErrorCode(status);
            }
            else {
                ReturnSuccess("msg.accountverified", response);
            }
        });
        return true;
    },
    purgepasswords: function(){
        LogStart("purgepasswords", gSettings.host);
        this.server.purgepasswords(function(status){
            if (!status) {
                ReturnSuccess("msg.synccompleted");
            }
            else {
                ReturnErrorCode(status);
            }
        });
        return true;

    },

    verifypin: function(pin) {
        // return if we're currently processing another request
        if (!SetBusy()) {
            return false;
        }
        LogStart("status", gSettings.host);

        this.server.verifypin(pin, function(status, response){
            if (status) {
                ReturnErrorCode(status);
            }
            else {
                ReturnSuccess("msg.pinverified", response);
            }
        });
        return true;
    },

    synchronize: function(automatic) {
        var prevState = GetState();

        // return if we're currently processing another request
        if (!SetBusy()) {
            return false;
        }

        LogStart("sync", gSettings.host);
        this.server.manual = automatic === true ? false : true;
        this.server.sync(prevState, function(status){
            if (!status) {
                ReturnSuccess("msg.synccompleted");
            }
            else {
                ReturnErrorCode(status);
            }
        });
        return true;
    },

    synchronizeInitial: function (remoteIsMaster, doMerge) {
        // return if we're currently processing another request
        if (!SetBusy()) {
            return false;
        }

        LogStart("initial sync", gSettings.host);
        this.server.manual = true;

        if (doMerge) {
            this.server.merge(!remoteIsMaster, Finished);
        } else {
            if (remoteIsMaster) {
                this.server.download(Finished);
            } else {
                this.server.upload(Finished);
            }
        }

        return true;

        function Finished(status) {
            if (!status) {
                ReturnSuccess("msg.synccompleted");
            } else {
                ReturnErrorCode(status);
            }
        }
    },

    upload: function () {
        // return if we're currently processing another request
        if (!SetBusy()) {
            return false;
        }

        LogStart("upload", gSettings.host);

        this.server.manual = true;
        this.server.upload(function(status){
            if (!status) {
                ReturnSuccess("msg.uploadcompleted");
            }
            else {
                ReturnErrorCode(status);
            }
        });
        return true;
    },

    download: function () {
        // return if we're currently processing another request
        if (!SetBusy()) {
            return false;
        }

        LogStart("download", gSettings.host);

        this.server.manual = true;
        this.server.download(function(status){
            if (!status) {
                ReturnSuccess("msg.remotefilecopied");
            }
            else {
                ReturnErrorCode(status);
            }
        });
        return true;
    },

    getProfileNames: function() {
        var prevState = GetState();

        var funcFinished = function(status, response) {
            if (!status) {
                LogWrite("GetProfileNames succeeded; response is " +
                        response.toSource());
                ReturnSuccess("error.0", response, prevState);
            } else {
                ReturnErrorMsg(status, MapError(status), prevState);
            }
        };
        // return if we're currently processing another request
        if (!SetBusy()) {
            return false;
        }

        LogStart("getProfileNames", gSettings.acctMgrHost);

        if (this.server.getProfileNames) {
            this.server.getProfileNames(funcFinished);
            return true;
        } else {
            return false;
        }

    },

    launchSuccessPage: function(){
        this.server.countItems("bookmarks",
            "bookmark", function(status, num_bookmarks){
            var currver = FoxmarksVersion();
            FoxmarksOpenInNewTab(gSettings.httpProtocol +
                gSettings.webHost + "/firefox/success/" + currver, 
                true, FoxmarksBuildPostData(num_bookmarks));
            gSettings.currVersion = currver;
        });
    },
    cancel: function() {
        this.server.cancel();
    },

    logWrite: function (msg) {
        if (!logStream)
            logFileOpen();

        var d = new Date();
        var year = d.getFullYear();
        var month = d.getMonth() + 1; if (month < 10) month = "0" + month;
        var day = d.getDate(); if (day < 10) day = "0" + day;
        var hour = d.getHours(); if (hour < 10) hour = "0" + hour;
        var minute = d.getMinutes(); if (minute < 10) minute = "0" + minute;
        var sec = d.getSeconds(); if (sec < 10) sec = "0" + sec;

        // format is [YYYY-MM-DD HH:MM:SS] msg\n
        var string = "[" + year + "-" + month + "-" + day + " " + hour + ":" +
            minute + ":" + sec + "] " + msg + "\n";

        if(gSettings.getDebugOption("dumplog"))
            dump("Foxmarks: " + string + "\n");
        logStream.write(string, string.length)
    },

    getState: function() {
        return GetState();
    },

    _password: null,
    _pin: null,

    getPassword: function() {
        return this._password;
    },

    setPassword: function(password) {
        this._password = password;
    },
    getPin: function() {
        return this._pin;
    },

    setPin: function(password) {
        this._pin = password;
    },

    getStorageEngine: function(synctype) {
        return getDatasourceAttribute(synctype, "engine");
    },

    getLastError: function() {
        return this.lastError;
    },

    lastError: 0,
    _uninstall: false,
    _channel: null,
    _pingListener: {
         onStartRequest: function () {},
         onDataAvailable: function () {},
         onStopRequest: function () {},
         onChannelRedirect: function (aOldChannel, aNewChannel, aFlags) {
            this._newchannel = aNewChannel;
         },
        getInterface: function (aIID) {
            try {
                return this.QueryInterface(aIID);
            } catch (e) {
                throw Components.results.NS_NOINTERFACE;
            }
        },
        onProgress : function (aRequest, aContext, aProgress, aProgressMax) { },
        onStatus : function (aRequest, aContext, aStatus, aStatusArg) { },
        onRedirect : function (aOldChannel, aNewChannel) { },
        QueryInterface : function(aIID) {
            if (aIID.equals(Components.interfaces.nsISupports) ||
                aIID.equals(Components.interfaces.nsIInterfaceRequestor) ||
                aIID.equals(Components.interfaces.nsIChannelEventSink) || 
                aIID.equals(Components.interfaces.nsIProgressEventSink) ||
                aIID.equals(Components.interfaces.nsIHttpEventSink) ||
                aIID.equals(Components.interfaces.nsIStreamListener))
            return this;
            throw Components.results.NS_NOINTERFACE;
         } 
     },
     pingServer: function(topic){
        var ioService = Components.classes["@mozilla.org/network/io-service;1"]
            .getService(Components.interfaces.nsIIOService);

        // create an nsIURI
        var attrs = [];
        var session = Date.now().toString(36);
        attrs.push("app="       + "jezebel");
        attrs.push("mid="       + gSettings.machineId);
        attrs.push("sess="      + session);
        attrs.push("page="      + topic);
        attrs.push("username="  + gSettings.username);
        attrs.push("no_cache="  + Date.now().toString(36));

        var query = attrs.join("&");
        var url = gSettings.httpProtocol + "tr.foxmarks.com/tracking/impressions.gif?" + query;
        this._pingRequest = new Request("GET",url, null, false,true);  
        this._pingRequest.Start(function(){});
    },
    getLastModified: function(synctype) {
        return FoxmarksSyncService.lastmodified;
    },

    get server() {
        if (!this._server) {
            this._server = new SyncServer();
        }
        return this._server;
    },

    /////////////////////////////////////////////////////////////////////////
    //
    // nsIObserver

    observe: function(subject, topic, data)  { // called at startup
        var timerCallback = {

            notify: function(timer) {

                var now = new Date().getTime();

                // scan entire bookmark set to find
                // last modified date for entire set
                // XXX: Implement

                // Do update nag if necessary
                if (gSettings.daysSinceLastUpdateNag > 28 &&
                    FoxmarksUpdateAvailable()) {
                    gSettings.lastNagDate = gSettings.NowAsGMT;
                    UpdateNag();
                }

                // Do automatic sync if necessary
                if (!IsBusy() && (!gFailureCount || now > gBackoffUntil) &&
                    gSettings.synchOnTimer && gSettings.haveSynced) {
                    if (gSettings.minutesSinceLastSync > 
                            gSettings.autoSynchFreq) {
                        FoxmarksSyncService.synchronize(true);
                    } else {
                        if (FoxmarksSyncService.lastmodified && gSettings.haveSynced && 
                            FoxmarksSyncService.lastmodified >
                            Date.parse(gSettings.lastSynchDate) &&
                            now - FoxmarksSyncService.lastmodified > 5 * 60 * 1000) {
                            FoxmarksSyncService.synchronize(true);
                        }
                    }
                }
            }
        }

        if (topic == "app-startup") {
            // Pre-initialization here.
            var os = Cc["@mozilla.org/observer-service;1"].
                getService(Ci.nsIObserverService);
            os.addObserver(this, "quit-application-requested", false);
            os.addObserver(this, "foxmarks-datasourcechanged", false);
            os.addObserver(this, "foxmarks-rununittest", false);
            os.addObserver(this, "foxmarks-unittesterror", false);
            os.addObserver(this, "earlyformsubmit", false);
            os.addObserver(this, "final-ui-startup", false);
            os.addObserver(this, "em-action-requested", false);
            os.addObserver(this, "quit-application-granted", false);
            os.addObserver(this, "foxmarks-showsettingpane", false);
        } else if (topic == "final-ui-startup") {
            // Real initialization starts here.
            FoxmarksSyncService = this;
            var dsList = loadDatasourceSet(true); 

            FoxmarksSyncService.nat = {}; 
            for(var x = 0; x < dsList.length; x++)
                FoxmarksSyncService.nat[dsList[x].syncType] = dsList[x].WatchForChanges(this.server);

            if (!gSettings.wizardSuppress && !gSettings.useOwnServer &&
                    !gSettings.haveSynced) {
                FoxmarksLaunchSetupWizard();
            } else if (gSettings.majorVersion < 2) {
                gSettings.majorVersion = 2;
                if (gSettings.hostname == "sync.foxmarks.com" || 
                        gSettings.hostname == "sync.foxcloud.com")  {
                    // Standard upgrade
                    FoxmarksLaunchSetupWizard();
                } else {
                    // Custom server upgrade
                    var sb = Bundle().GetStringFromName;
                    Cc["@mozilla.org/embedcomp/prompt-service;1"].
                        getService(Ci.nsIPromptService).
                        alert(null, sb("appname.long"), 
                        sb("msg.upgrade2custom"));
                    gSettings.useOwnServer = true;
                    gSettings.url = gSettings.serverType + "://" + 
                        gSettings.hostname + 
                        gSettings.path.replace("{username}", 
                            gSettings.username) +
                        "foxmarks.json";
                }
            } else {
                // need to check for upgrades here
                var currver = FoxmarksVersion();
                var lastver = gSettings.currVersion;
                var ca = currver.split(".");
                var la = lastver.split(".");
                var newver =false;
                
                if(ca.length != la.length){
                    newver = true;
                } else {
                    for(var x=0; x < ca.length-1; x++){
                        if(parseInt(ca[x]) != parseInt(la[x])){
                            newver = true;
                            break;
                        }
                    }
                }
                if(newver){
                    FoxmarksLaunchUpgradePage();
                }
            }

            this.timer = Cc["@mozilla.org/timer;1"].createInstance(Ci.nsITimer);
            this.timer.initWithCallback(timerCallback, 1000*60,
                Ci.nsITimer.TYPE_REPEATING_SLACK);
        } else if (topic == "quit-application-requested") {
            HandleShutdown();
        } else if(topic == "em-action-requested"){
            subject.QueryInterface(Components.interfaces.nsIUpdateItem);
            if(subject.id == "foxmarks@kei.com"){
                switch(data){
                    case 'item-uninstalled':
                        this._uninstall = true;
                        this.pingServer("uninstall");
                        break;
                    case 'item-disabled':
                        this.pingServer("disable");
                        break;
                    case 'item-cancel-action':
                        if(this._uninstall == false){
                            this.pingServer("cancel-disable");
                        } else {
                            this.pingServer("cancel-uninstall");
                        }
                        this._uninstall = false;
                        break;
                }

            }

        } else if(topic == "quit-application-granted"){
            if(this._uninstall){
                gSettings.clearAllPrefs();
            }
        } else if(topic == "foxmarks-showsettingpane"){
            if(data.length > 0){
                OpenFoxmarksSettingsDialog(data);
            }
        } else if (topic == "foxmarks-unittesterror"){
            try {
                ReturnErrorCode(parseInt(data));
            }
            catch(e){
                Components.utils.reportError(e);
            }
        } else if (topic == "foxmarks-rununittest"){
            this.server.runUnitTest();
        } else if (topic == "foxmarks-datasourcechanged") {
            var a = data.split(';');
            this.lastmodified = parseInt(a[0]);
            var okState = (GetState() == "ready" || GetState() == "unknown");
            if (okState && gSettings.haveSynced &&
                gSettings.isSyncEnabled(a[1]) && 
                this.lastmodified > Date.parse(gSettings.lastSynchDate)) {
                SetState("dirty");
            }
        } else {
            LogWrite("Yikes unknown topic " + topic);
        }
    },

    /////////////////////////////////////////////////////////////////////////
    // nsIFormSubmitObserver
    notify : function (formElement, aWindow, actionURI) {
        if(FoxmarksSyncService.nat["passwords"])
            FoxmarksSyncService.nat["passwords"].formsubmit(formElement);
        return true;
    },

    /////////////////////////////////////////////////////////////////////////
    // nsIClassInfo
    getInterfaces: function (aCount) {
        var interfaces = [Ci.nsIFoxmarksService,
        Ci.nsIObserver,
        Ci.nsIFormSubmitObserver,
        Ci.nsiRDFObserver];
        aCount.value = interfaces.length;
        return interfaces;
    },

    getHelperForLanguage: function (aLanguage) {
        return null;
    },

    get contractID() {
        return "@foxcloud.com/extensions/foxmarks;1";
    },

    get classDescription() {
        return "Foxmarks Service";
    },

    get classID() {
        return Components.ID("{49ace257-6111-48b2-a988-f9eb38b0fa58}");
    },

    get implementationLanguage() {
        return Ci.nsIProgrammingLanguage.JAVASCRIPT;
    },

    get flags() {
        return Ci.nsIClassInfo.SINGLETON;
    },

    /////////////////////////////////////////////////////////////////////////
    // nsISupports
    QueryInterface: function (aIID) {
        if (!aIID.equals(Ci.nsIFoxmarksService) &&
            !aIID.equals(Ci.nsISupports) &&
            !aIID.equals(Ci.nsIRDFObserver) &&
            !aIID.equals(Ci.nsIFormSubmitObserver) &&
            !aIID.equals(Ci.nsIObserver))
        throw Components.results.NS_ERROR_NO_INTERFACE;
        return this;
    }
};

var gModule = {
    _firstTime: true,

    registerSelf: function (aComponentManager, aFileSpec, aLocation, aType) {
        if (this._firstTime) {
            this._firstTime = false;
            throw Components.results.NS_ERROR_FACTORY_REGISTER_AGAIN;
        }


        aComponentManager = aComponentManager.
        QueryInterface(Ci.nsIComponentRegistrar);

        for (var key in this._objects) {
            var obj = this._objects[key];
            aComponentManager.registerFactoryLocation(obj.CID, obj.className,
                obj.contractID, aFileSpec, aLocation, aType);
        }

        // Make the Foxmarks Service a startup observer
        var cm = Cc["@mozilla.org/categorymanager;1"].
        getService(Ci.nsICategoryManager);
        cm.addCategoryEntry("app-startup", this._objects.service.className,
            "service," + this._objects.service.contractID, true, true, null);
    },


    getClassObject: function (aComponentManager, aCID, aIID) {
        if (!aIID.equals(Ci.nsIFactory))
            throw Components.results.NS_ERROR_NOT_IMPLEMENTED;

        for (var key in this._objects) {
            if (aCID.equals(this._objects[key].CID))
                return this._objects[key].factory;
        }

        throw Components.results.NS_ERROR_NO_INTERFACE;
    },

    _makeFactory: #1= function(ctor) {
        return {
            createInstance: function (outer, iid) {
                if (outer != null)
                    throw Components.results.NS_ERROR_NO_AGGREGATION;
                return (new ctor()).QueryInterface(iid);
            }
        };
    },

    _objects: {
        service: { CID : nsFoxmarksService.prototype.classID,
            contractID : nsFoxmarksService.prototype.contractID,
            className  : nsFoxmarksService.prototype.classDescription,
            factory    : #1#(nsFoxmarksService)
        }
    },

    canUnload: function (aComponentManager)
    {
        return true;
    }
};

function NSGetModule(compMgr, fileSpec)
{
    return gModule;
}
