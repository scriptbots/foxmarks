/* 
 Copyright 2005-2008 Foxmarks Inc.
 
 foxmarks-settings.js: implements FoxmarksSettings, an object that wraps
 access to persistent settings, both user settings and internal stored values.
   
 */

// TO DO:
// * If user changes username or password, delete our cookie.

var Cc = Components.classes;
var Ci = Components.interfaces;
var CCon = Components.Constructor;
const SYNC_REALM = "Foxmarks Sync Login";
const SYNC_REALM_PIN = "Foxmarks Sync PIN";

function Bundle() {
  var sb = Components.classes["@mozilla.org/intl/stringbundle;1"]
      .getService(Components.interfaces.nsIStringBundleService)
      .createBundle("chrome://foxmarks/locale/foxmarks.properties");
  return sb;
}

// Notify takes the given args object and passes it to observers.
// By convention, args contains at least "status", an integer with
// the following interpretation:
//   0: operation completed successfully.
//   1: operation continues; msg is status update only.
//   2: operation was cancelled by user.
//   3: component finished
//   other: operation failed.
// Similarly, "msg" contains a user-displayable message.

function Notify(args) {
    var os = Cc["@mozilla.org/observer-service;1"]
        .getService(Ci.nsIObserverService);

    var str = args.toSource();        
    os.notifyObservers(null, "foxmarks-service", str);
}

function SetProgressComponentStatus(id, phase){
    Notify({status: 3, component: id, phase: phase} );
}
function SetProgressMessage(msgname) {
    var msg;
    try {
        msg = Bundle().GetStringFromName(msgname);
    } catch(e) {
        msg = "untranslated(" + msgname + ")";
    }

    Notify({status: 1, msg: msg} );
}

function FoxmarksAlert(str){
    var ps = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
        .getService(Components.interfaces.nsIPromptService);
    ps.alert(null,"Foxmarks Bookmark Synchronizer", str);
}

function MapErrorUrl(status) {
    var error = "";

    status = status & 0x0000ffff;

    try {
        error = Bundle().GetStringFromName("errorurl." + status);
    } catch (e) {
        if(UnknownError(status)){
            error = Bundle().GetStringFromName("errorurl.unknown");
        } else {
            error = "";
        }
    }

    return error;
} 
function UnknownError(status){
    var result = false;
    status = status & 0x0000ffff;

    try {
        Bundle().GetStringFromName("error." + status);
        result = false;
    } catch (e) {
        result = true;
    }

    return result;
}
function MapErrorMessage(status) {
    var error = "";

    status = status & 0x0000ffff;

    try {
        error = Bundle().GetStringFromName("errormsg." + status);
    } catch (e) {
        if(UnknownError(status)){
            error = Bundle().formatStringFromName(
                "errormsg.unknown", [status], 1);
        } else {
            error = "";
        }
    }

    return error;
} 
function MapError(status) {
    var error = "";

    status = status & 0x0000ffff;

    try {
        error = Bundle().GetStringFromName("error." + status);
    } catch (e) {
        error = Bundle().formatStringFromName("error.unknown", [status], 1);
    }

    return error;
} 

/**
* Convert a string containing binary values to hex.
* Shamelessly stolen from nsUpdateService.js
*/
function binaryToHex(input) {
    var result = "";
    for (var i = 0; i < input.length; ++i) {
        var hex = input.charCodeAt(i).toString(16);
        if (hex.length == 1)
            hex = "0" + hex;
        result += hex;
    }
    return result;
}

function hex_md5(string) {
    var arr = new Array();
    
    for (var i = 0; i < string.length; ++i)
        arr[i] = string.charCodeAt(i);
        
    try {
        var hash = Components.classes["@mozilla.org/security/hash;1"].
                    createInstance(Components.interfaces.nsICryptoHash);
        hash.initWithString("md5");
        hash.update(arr, arr.length);
        var digest = binaryToHex(hash.finish(false));
    } catch (e) {
        var ps = Components.classes
            ["@mozilla.org/embedcomp/prompt-service;1"]
            .getService(Components.interfaces.nsIPromptService);
        ps.alert(null, "Foxmarks Bookmark Synchronizer", e);
    } 
    return digest;    // 8 bytes seems sufficient for our purposes
}

// Return the version string associated with the currently installed version
function FoxmarksExtensionManagerLiteral(value) {
    var rdfs = Components.classes["@mozilla.org/rdf/rdf-service;1"].
        getService(Components.interfaces.nsIRDFService);
    var ds = Components.classes["@mozilla.org/extensions/manager;1"].
        getService(Components.interfaces.nsIExtensionManager).datasource;
    var s = rdfs.GetResource("urn:mozilla:item:foxmarks@kei.com");
    var p = rdfs.GetResource("http://www.mozilla.org/2004/em-rdf#" + value);
    var t = ds.GetTarget(s, p, true);
    if (t instanceof Components.interfaces.nsIRDFLiteral)
        return t.Value;
    else
        return "unknown";
}

function FoxmarksVersion() {
    return FoxmarksExtensionManagerLiteral("version");
}

function FoxmarksUpdateAvailable() {
    var none = ["none", "unknown"];

    return none.indexOf(FoxmarksExtensionManagerLiteral(
            "availableUpdateURL")) < 0;
}

function FoxmarksSettings() {
    var ps = Cc["@mozilla.org/preferences-service;1"].
            getService(Ci.nsIPrefService);
        
    this.prefs = ps.getBranch("foxmarks.");
    this.ps = ps;
    this._auth = "";
}

FoxmarksSettings.prototype = {
    prefs: null,

    // Only call this for uninstalls (it nukes all prefs)
    clearAllPrefs: function(){
        this.pin = "";
        this.password = "";
        this.prefs.deleteBranch("");
    },
    
    getCharPref: function(string, def) {
        var result;
        
        try {
            result = this.prefs.getCharPref(string);
        } catch (e) {
            result = def;
        }
        
        return result;
    },

    getIntPref: function(string, def) {
        var result;
        
        try {
            result = this.prefs.getIntPref(string);
        } catch (e) {
            result = def;
        }
        
        return result;
    },


    getBoolPref: function(string, def) {
        var result;
        
        try {
            result = this.prefs.getBoolPref(string);
        } catch (e) {
            result = def;
        }
        
        return result;
    },


    formatDate: function(d) {
        return d.toLocaleDateString() + " " + d.toLocaleTimeString();
    },

    // get fundamental settings

    get username() {
        return this.getCharPref("username", "");
    },

    get httpProtocol() {
        return this.securityLevel == 1 ? "https://" : "http://";
    },

    get sessionPin() {
        var fms = Cc["@foxcloud.com/extensions/foxmarks;1"].
            getService(Ci.nsIFoxmarksService);

        return fms.getPin();
    },

    set sessionPin(pw) {
        var fms = Cc["@foxcloud.com/extensions/foxmarks;1"].
            getService(Ci.nsIFoxmarksService);

        fms.setPin(pw);
    },
    get sessionPassword() {
        var fms = Cc["@foxcloud.com/extensions/foxmarks;1"].
            getService(Ci.nsIFoxmarksService);

        return fms.getPassword();
    },

    set sessionPassword(pw) {
        var fms = Cc["@foxcloud.com/extensions/foxmarks;1"].
            getService(Ci.nsIFoxmarksService);

        fms.setPassword(pw);
    },
    removePIN: function(){
        var lm = Cc["@mozilla.org/login-manager;1"].
            getService(Ci.nsILoginManager);
        var nsli = new CCon("@mozilla.org/login-manager/loginInfo;1",
            Ci.nsILoginInfo, "init");
        var oldli = new nsli(this.host, null, SYNC_REALM_PIN, 
            this.username, this.pinNoPrompt, "", "");

        lm.removeLogin(oldli);
        this.sessionPin = "";
    },

    set pin(pin) {
        if (!this.rememberPin) {
            this.sessionPin = pin;
        } else {
            if ("@mozilla.org/login-manager;1" in Cc) {
                // Can't set password without username.
                if (!this.username)
                    return;
                var lm = Cc["@mozilla.org/login-manager;1"].
                    getService(Ci.nsILoginManager);
                var nsli = new CCon("@mozilla.org/login-manager/loginInfo;1",
                    Ci.nsILoginInfo, "init");
                var newli = new nsli(this.host, null, SYNC_REALM_PIN, 
                    this.username, pin, "", "");
                var oldli = new nsli(this.host, null, SYNC_REALM_PIN, 
                    this.username, this.pinNoPrompt, "", "");
                try {
                    lm.modifyLogin(oldli, newli);
                } catch (e) {
                    lm.addLogin(newli);
                }
            }
        }
    },

    get pin() {

        var pw = this.pinNoPrompt;

        if (pw != null)
            return pw;

        var pin = { value: "" };
        var remember = { value: this.rememberPin };

        var sb = Bundle().GetStringFromName;
        var rv = Cc["@mozilla.org/embedcomp/prompt-service;1"].
             getService(Ci.nsIPromptService).
             promptPassword(null, sb("appname.long"), 
                 sb("prompt.pin"),
                  pin,
                 sb("prompt.rememberpin"),
                 remember);

        if (!rv) {
            throw 2;
        }

        this.pin = pin.value;
        this.rememberPin = remember.value;

        return pin.value;
    },

    get pinNoPrompt() {
        if (!this.rememberPin && this.sessionPin) {
            return this.sessionPin;
        }

        if (this.rememberPin) {
            if ("@mozilla.org/login-manager;1" in Cc) {
                var lm = Cc["@mozilla.org/login-manager;1"].
                    getService(Ci.nsILoginManager);
                var logins = lm.findLogins({}, this.host, null, SYNC_REALM_PIN);
                for (var i = 0; i < logins.length; ++i) {
                    if (logins[i].username == this.username) {
                        return logins[i].password;
                    }
                }
            }
        }
        return null;    // couldn't fetch password
    },

    get password() {

        var pw = this.passwordNoPrompt;

        if (pw != null)
            return pw;

        var username = { value: this.username };
        var password = { value: "" };
        var remember = { value: this.rememberPassword };

        var sb = Bundle().GetStringFromName;
        var rv = Cc["@mozilla.org/embedcomp/prompt-service;1"].
             getService(Ci.nsIPromptService).
             promptUsernameAndPassword(null, sb("appname.long"), 
                 sb("prompt.usernamepassword"),
                 username, password,
                 sb("prompt.rememberpassword"),
                 remember);

        if (!rv) {
            throw 2;
        }

        this.rememberPassword = remember.value;
        this.username = username.value;
        this.password = password.value;

        return password.value;
    },

    get passwordNoPrompt() {
        if (!this.rememberPassword && this.sessionPassword) {
            return this.sessionPassword;
        }

        if (this.rememberPassword) {
            if ("@mozilla.org/passwordmanager;1" in Cc) {
                var host = {};
                var user = {};
                var pass = {}; 
                try {
                    var pmi = Cc["@mozilla.org/passwordmanager;1"].
                        createInstance(Ci.nsIPasswordManagerInternal);
                    pmi.findPasswordEntry(this.host, this.username, 
                        "", host, user, pass);
                    this.sessionPassword = pass.value;
                    return pass.value;
                } catch(e) { }
            } else if ("@mozilla.org/login-manager;1" in Cc) {
                var lm = Cc["@mozilla.org/login-manager;1"].
                    getService(Ci.nsILoginManager);
                var logins = lm.findLogins({}, this.host, null, SYNC_REALM);
                for (var i = 0; i < logins.length; ++i) {
                    if (logins[i].username == this.username) {
                        return logins[i].password;
                    }
                }
                logins = lm.findLogins({}, this.host, "", null);
                for (var i = 0; i < logins.length; ++i) {
                    if (logins[i].username == this.username) {
                        try {
                            var password = logins[i].password;
                            var nsli = new 
                                CCon("@mozilla.org/login-manager/loginInfo;1",
                                Ci.nsILoginInfo, "init");
                            lm.removeLogin(logins[i]);
                            var newli = new nsli(this.host, null, SYNC_REALM, 
                                this.username, password, "", "");
                            lm.addLogin(newli);

                        } catch(e){

                        }

                        return password;
                    }
                }
            }
        }
        return null;    // couldn't fetch password
    },

    get hash() {
        var fms = Cc["@foxcloud.com/extensions/foxmarks;1"].
            getService(Ci.nsIFoxmarksService);

        return hex_md5((this.useOwnServer ? 
                this.url : this.host + this.username) + 
            fms.getStorageEngine("bookmarks")).slice(16)
            + ".";
    },
            
    get lastSynchDate() {
        return this.getCharPref(this.hash + "lastSynchDate", "");
    },

    get haveSynced() {
        return this.lastSynchDate != "";
    },

    getLastSyncDate: function(syncType){
        if(syncType == "bookmarks")
            return this.getCharPref(this.hash + "lastSynchDate", "");
        else
            return this.getCharPref(this.hash + syncType + "-lastSynchDate",
                    "");
    },
    
    getHaveSynced: function(syncType){
        return this.getLastSyncDate(syncType) != "";

    },

    setLastSyncDate: function(syncType, string){
        if(syncType == "bookmarks")
            return this.prefs.setCharPref(this.hash + "lastSynchDate", string);
        else
            return this.prefs.setCharPref(this.hash + syncType + "-lastSynchDate",
                    string);
    },

    get minutesSinceLastSync() {
        if (!this.haveSynced)
          return 0;
      
        var syncMS = new Date(this.lastSynchDate).getTime();
        var nowMS = Date.now();
        return (nowMS - syncMS) / 60000;
  
    },
  
    get daysSinceLastUpdateNag() {
        if (!this.lastNagDate)
            return Infinity;
        var updateMS = new Date(this.lastNagDate).getTime();
        var nowMS = Date.now();
        return (nowMS - updateMS) / (60000 * 60 * 24);
    },
  
    get lastNagDate() {
        return this.getCharPref("lastNagDate", null);
    },
    
    set lastNagDate(string) {
        this.prefs.setCharPref("lastNagDate", string);
    },
    
    get lastSynchDisplayDate() {
        if (!this.haveSynced) {
            return Bundle().GetStringFromName("msg.neversynced");
        } else {
            return this.formatDate(new Date(this.lastSynchDate));
        }
    },

    setEtag: function(syncType, string){
        if(syncType == "bookmarks"){
            this.prefs.setCharPref(this.hash + "etag", string);
        }
        else {
            this.prefs.setCharPref(this.hash + 
                    "-" + syncType + "-etag", string);
        }
    },
    getEtag: function(syncType){
        if(syncType == "bookmarks"){
            return this.getCharPref(this.hash + "etag", "");
        }
        else {
            return this.getCharPref(this.hash + "-" + syncType + "-etag", "");
        }
    },
    
    
    setToken: function(syncType, string){
        if(syncType == "bookmarks"){
            return this.prefs.setCharPref(this.hash + "token", string);
        }
        else {
            return this.prefs.setCharPref(this.hash + "-" + syncType + "-token", string);
        }

    },
    getToken: function(syncType){
        if(syncType == "bookmarks"){
            return this.getCharPref(this.hash + "token", "");
        }
        else {
            return this.getCharPref(this.hash + "-" + syncType + "-token", "");
        }

    },
    
    get writeCount() {
        return this.getIntPref("writeCount", 0);
    },

    get lastError() {
        return this.getIntPref("lastError", 0);
    },
    set lastError(err){
        this.prefs.setIntPref("lastError", err);
    },
    get synchOnTimer() {
        return this.getBoolPref("synchOnTimer", true);
    },
    get useBaselineCache() {
        return this.getBoolPref("memory-useBaselineCache", true);
    },
    get forceGC() {
        return this.getBoolPref("memory-forceGC", false);
    },

    isSyncEnabled: function(syncType){
        return this.getBoolPref("sync-"+syncType, syncType == "bookmarks");
    },

    setSyncEnabled: function(syncType, val){
        this.prefs.setBoolPref("sync-"+syncType, val);
    },
    
    mustUpload: function(syncType){
        return this.getBoolPref("uploadreq-"+syncType, false);
    },
    setMustUpload: function(syncType, val){
        this.prefs.setBoolPref("uploadreq-"+syncType, val);
    },
    get autoSynchFreq() {
        return this.getIntPref("autoSynchFreq", 60);
    },
    
    get syncOnShutdown() {
        return this.getIntPref("syncOnShutdown", true) != 0;
    },

    get syncOnShutdownAsk() {
        return this.getBoolPref("syncOnShutdownAsk", true);
    },
    
    get debugUI() {
        return this.getBoolPref("debugUI", false);
    },
    
    get wizardSuppress() {
        return this.getBoolPref("wizardNoShow", false);
    },
  
    set wizardSuppress(bool) {
       this.prefs.setBoolPref("wizardNoShow", bool);
    },

    get disableIfMatchOnPut() {
        return this.getBoolPref("disableIfMatchOnPut", false);
    },

    set enableLogging(bool) {
        this.prefs.setBoolPref("enableLogging", bool);
    },
    get enableLogging() {
        return this.getBoolPref("enableLogging", true);
    },

    get rememberPassword() {
        return this.getBoolPref("rememberPassword", true);
    },

    set rememberPassword(bool) {
        this.prefs.setBoolPref("rememberPassword", bool);
    },


    get rememberPin() {
        return this.getBoolPref("rememberPin", true);
    },

    set rememberPin(bool) {
        this.prefs.setBoolPref("rememberPin", bool);
    },

    set username(string) {
        string = string.replace(/^\s+|\s+$/g, '')
        if (string != this.username) {
            this.prefs.setCharPref("username", string);
            this.ClearCredentials();
        }
    },
    
    set password(password) {
        if (this.passwordNoPrompt != password) {
            this.ClearCredentials();
        }
        if (!this.rememberPassword) {
            this.sessionPassword = password;
        } else {
            if(!password)
                password = "";
            if ("@mozilla.org/passwordmanager;1" in Cc) {
                // Can't set password without username.
                if (!this.username)
                    return;
                var pm = Cc["@mozilla.org/passwordmanager;1"]
                    .createInstance(Ci.nsIPasswordManager);
                try { 
                    pm.removeUser(this.host, this.username);
                } catch(e) {}
                if(password.length > 0)
                    pm.addUser(this.host, this.username, password);
            } else if ("@mozilla.org/login-manager;1" in Cc) {
                // Can't set password without username.
                if (!this.username)
                    return;
                var lm = Cc["@mozilla.org/login-manager;1"].
                    getService(Ci.nsILoginManager);
                var nsli = new CCon("@mozilla.org/login-manager/loginInfo;1",
                    Ci.nsILoginInfo, "init");
                var newli = new nsli(this.host, null, SYNC_REALM, 
                    this.username, password, "", "");
                var oldli = new nsli(this.host, null, SYNC_REALM, 
                    this.username, this.passwordNoPrompt, "", "");
                try {
                    if(password.length == 0){
                        lm.removeLogin(oldli);
                    }
                    else {
                        lm.modifyLogin(oldli, newli);
                    }
                } catch (e) {
                    if(password.length > 0)
                        lm.addLogin(newli);
                }
            }
        }
    },
    
    ClearCredentials: function() {
        var cm = Cc["@mozilla.org/cookiemanager;1"].
            getService(Ci.nsICookieManager);
        cm.remove(".staging.foxmarks.com", "SYNCD_AUTH", "/", false);
        cm.remove(".foxmarks.com", "SYNCD_AUTH", "/", false);
    },

    set lastSynchDate(string) {
        this.prefs.setCharPref(this.hash + "lastSynchDate", string);
    },

    set writeCount(integer) {
        this.prefs.setIntPref("writeCount", integer);
    },
        
    set autoSynchFreq(integer) {
        this.prefs.setIntPref("autoSynchFreq", integer);
    },
    
    set synchOnTimer(bool) {
        this.prefs.setBoolPref("synchOnTimer", bool);
    },
    
    set syncOnShutdown(integer) {
        this.prefs.setIntPref("syncOnShutdown", integer);
    },
    
    set syncOnShutdownAsk(bool) {
        this.prefs.setBoolPref("syncOnShutdownAsk", bool);
    },

    set debugUI(bool) {
        this.prefs.setBoolPref("debugUI", bool);
    },

    
    // get calculated settings
    get calcPath() {
        return this.path.replace("{username}", this.username);
    },
       
    get NowAsGMT() {
        var d = new Date();
        return d.toGMTString();
    },
    

    SyncComplete: function(syncType) {
        this.setLastSyncDate(syncType, this.NowAsGMT);
    },

    // Additions to support Sync2
    get useOwnServer() {
        return this.getBoolPref("useOwnServer", false);
    },

    set useOwnServer(bool) {
        this.prefs.setBoolPref("useOwnServer", bool);
    },

    set url(u) {
        this.prefs.setCharPref("url-bookmarks", u);
    },

    get url() {
        return this.getCharPref("url-bookmarks",
            this.getCharPref("url", ""));
    },

    set passwordurl(u) {
        this.prefs.setCharPref("url-passwords", u);
    },

    get passwordurl() {
        return this.getCharPref("url-passwords", "");
    },

    set hideStatusIcon(b) {
        this.prefs.setBoolPref("hideStatusIcon", b);
        var os = Cc["@mozilla.org/observer-service;1"].
            getService(Ci.nsIObserverService);
        os.notifyObservers(null, "foxmarks-statechange", 
            gSettings.hideStatusIcon ?  "hide" : "show")
    },

    get hideStatusIcon() {
        return this.getBoolPref("hideStatusIcon", false);
    },

    getUrlWithUsernameAndPassword: function(syncType){
        var url;
        if(syncType == "bookmarks")
            url = this.url;
        else
            url = this.getCharPref("url-" + syncType, "");
            
        var user = this.username;
        var pw = this.password;
        
        if (pw.length) {
            user += ":" + pw;
        }

        if (user.length) {
            user += "@";
        }

        return url.replace("://", "://" + user);
    },

    get majorVersion() {
        return this.getIntPref("majorVersion", 1);
    },

    set majorVersion(ver) {
        this.prefs.setIntPref("majorVersion", ver);
    },

    get currVersion(){
        return this.getCharPref("lastUpdateVersion", "");
    },

    set currVersion(ver){
        this.prefs.setCharPref("lastUpdateVersion", ver);
    },

    get host() {
        if (this.useOwnServer) {
            var exp = /(.*):\/\/([^\/]*)/;
            var result = this.url.match(exp);
            if (!result) {
                return null;
            } else {
                return result[1] + "://" + result[2];
            }
        } else {
            return this.getCharPref("host-bookmarks",
                       this.getCharPref("host", "sync.foxmarks.com"));
        }
    },

    setDebugOption: function(opt, val){
        this.prefs.setBoolPref("debug-" + opt, val);
    },
    getDebugOption: function(opt){
        return this.getBoolPref("debug-" + opt, false);
    },
    getUnitTestOption: function(opt){
        return this.getIntPref("unittest-" + opt, 0);
    },
    getServerHost: function(syncType){
        if(syncType == "bookmarks" || this.useOwnServer)
            return this.host;
        else
            return this.getCharPref("host-" + syncType, "sync.foxmarks.com");
    },

    get acctMgrHost() {
        return this.useOwnServer ? "" : 
            this.getCharPref("host-login",
                this.getCharPref("acctMgrHost",
                    this.host.replace("sync", "login")
                )
            );
    },

    get truncateLog(){
        return this.getBoolPref("truncateLog", true);

    },
    get webHost() {
        return this.useOwnServer ? "www.foxmarks.com" : 
            this.getCharPref("host-www",
                this.getCharPref("acctMgrHost",
                    this.host.replace("sync", "www")
                )
            );
    },
    get wizardUrl() {
        return this.getCharPref("wizardUrl", "https://" + 
            this.acctMgrHost + "/wizard");
    },

    // -1: never synced
    //  0: likely synced in prior installation
    //  > 0: definitely synced
    get currentRevision() {
        return this.getIntPref(this.hash + "currentRevision", -1);
    },

    set currentRevision(cv) {
        if (cv != this.currentRevision) {
            this.prefs.setIntPref(this.hash + "currentRevision", cv);
            this.ps.savePrefFile(null);     // ensure it gets flushed
        }
    },

    GetSyncRevision: function(syncType) {
        if(syncType == "bookmarks")
            return this.getIntPref(this.hash + "currentRevision", -1);
        else    
            return this.getIntPref(this.hash + syncType + "-currentRevision", -1);
    },

    SetSyncRevision: function(syncType,cv) {
        if (cv != this.GetSyncRevision(syncType)) {
            if(syncType == "bookmarks")
                this.prefs.setIntPref(this.hash + "currentRevision", cv);
            else
                this.prefs.setIntPref(this.hash + syncType + "-currentRevision", cv);
            this.ps.savePrefFile(null);     // ensure it gets flushed
        }
    },
    get securityLevel() {
        // -1: use cleartext throughout
        //  0: use SSL for auth, cleartext otherwise (default)
        //  1: use SSL everywhere
        return this.getIntPref("securityLevel", 0);
    },

    set securityLevel(level) {
        this.prefs.setIntPref("securityLevel", level);
    },

    get disableIconSync() {
        return this.getBoolPref("disableIconSync", false);
    },

    get disableDirtyOnBatch() {
        return this.getBoolPref("disableDirtyOnBatch", false);
    },

    get machineId() {
        var id = this.getCharPref("machineId", null);
        if (!id) {
            id = Date.now().toString(36);
            this.prefs.setCharPref("machineId", id);
        }
        return id;
    },

    get viewId() {
        return this.getIntPref(this.hash + "viewId", 0);
    },

    set viewId(vid) {
        this.prefs.setIntPref(this.hash + "viewId", vid);
    },

    get viewName() {
        return this.getCharPref(this.hash + "viewName", this.viewId ?
            String(this.viewId) : 
            Bundle().GetStringFromName("profile.globalname"));
    },

    set viewName(name) {
        this.prefs.setCharPref(this.hash + "viewName", name);
    },

    get syncShortcutKey() {
        return this.getCharPref("shortcut.SyncNow", "");
    },

    get openSettingsDialogShortcutKey() {
        return this.getCharPref("shortcut.OpenSettings", "");
    }
}

var gSettings = new FoxmarksSettings();
