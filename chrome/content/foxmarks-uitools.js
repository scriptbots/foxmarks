/* 
 Copyright 2008 Foxmarks Inc.

 foxmarks-uitools.js: Various and sundry UI functions. 

 */

var Cc = Components.classes;
var Ci = Components.interfaces;

function FoxmarksOpenWindowByType(inType, uri, features, args) {
    var wm = Cc['@mozilla.org/appshell/window-mediator;1'].
        getService(Ci.nsIWindowMediator);
    var topWindow = wm.getMostRecentWindow(inType);

    if (topWindow) {
        topWindow.focus();
    } else {
        topWindow = wm.getMostRecentWindow(null);
        var win = topWindow.openDialog(uri, "_blank", features || "chrome",
            args);
    }
}

function FoxmarksOpenInNewTab(url, focus, postData) {
    var wm = Cc['@mozilla.org/appshell/window-mediator;1'].
        getService(Ci.nsIWindowMediator);
    var topWindow = wm.getMostRecentWindow('navigator:browser');
    if (topWindow) {
        var content = topWindow.document.getElementById('content');
        if(postData !== undefined){
            var stringStream = Cc["@mozilla.org/io/string-input-stream;1"].
                createInstance(Ci.nsIStringInputStream);
            var txt = postData.toJSONString();
            if ("data" in stringStream) // Gecko 1.9 or newer
                    stringStream.data = txt;
            else // 1.8 or older
                stringStream.setData(txt, txt.length);
                               
            var pd = Cc["@mozilla.org/network/mime-input-stream;1"].
                           createInstance(Ci.nsIMIMEInputStream);
            pd.addHeader("Content-Type", "application/json");
            pd.addContentLength = true;
            pd.setData(stringStream);

            content.selectedTab =
                content.addTab(url, null,null , pd);
        } else {
            content.selectedTab =
                content.addTab(url);
        }
        if (focus) {
            topWindow.focus();
        }
    }
}

function FoxmarksOpenInNewWindow(url) {
    openDialog("chrome://browser/content/browser.xul", "_blank",
        "chrome,all,dialog=no", url);
}

function OpenFoxmarksSettingsDialog(pane) {
    FoxmarksOpenWindowByType("foxmarks:settings",
        "chrome://foxmarks/content/foxmarks-dialog.xul", 
        "chrome,toolbar,centerscreen",
        [pane || "foxmarks-mainpane"]);
}

function MyFoxmarks() {
    if(gSettings.securityLevel == 1){
        FoxmarksOpenInNewTab("https://my.foxmarks.com/", true);
    } else {
        FoxmarksOpenInNewTab("http://my.foxmarks.com/", true);
    }
}

function FoxmarksOpenWizard(manual, skipAuth) {
    if (skipAuth) {
        FoxmarksOpenWindowByType("foxmarks:setup",
            "chrome://foxmarks/content/foxmarks-setup.xul",
            "chrome,centerscreen,dialog=no", manual);
    } else {
        FoxmarksOpenWindowByType("foxmarks:login", 
            "chrome://foxmarks/content/foxmarks-login.xul",
            "chrome,centerscreen,dialog=no", manual);
    }
}

function FoxmarksOnWizardCancel() {
    var ps = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
        .getService(Components.interfaces.nsIPromptService);

    var checkResult = {};
    checkResult.value = gSettings.wizardSuppress;
    var sb = Bundle();

    var ret = ps.confirmCheck(window, sb.GetStringFromName("title.cancelsetup"),
            sb.GetStringFromName("msg.cancelsetup"),
            sb.GetStringFromName("msg.nowizard"),
            checkResult);

    gSettings.wizardSuppress = checkResult.value;
    gSettings.majorVersion = 2;

    return ret;
}

function Synch() {
    PerformAction("synch");
}

function FoxmarksOpenStatusWindow() {
    PerformAction("showStatus");
}

function PerformAction(action, arg) {
    var retval = { helpurl: null };

    try {
        var win = window.openDialog(
            "chrome://foxmarks/content/foxmarks-progress.xul", "_blank",
            "chrome,dialog,modal,centerscreen", action, retval, arg);
        if (retval.helpurl) {
            FoxmarksOpenInNewWindow(retval.helpurl);   
        }
    } catch (e) {
       // FoxmarksAlert(e.message);
    }
    /*
    if (retval.status == 401) {
        FoxmarksAlert(Bundle().GetStringFromName("msg.invalidcredentials"));
    }
    */
    return retval.status;
}

var serviceObserver = {
    os: Cc["@mozilla.org/observer-service;1"].
        getService(Ci.nsIObserverService),

    observe: function(subject, topic, data) {
        var result = eval("(" + data + ")");
        if (this.text) {
            this.text.value = result.msg;
        }
        if (result.status != 1 && result.status != 3) {
            this.os.removeObserver(this, "foxmarks-service");
            if (this.spinner) {
                this.spinner.hidden = true;
            }
            if (this.callback) {
                var callback = this.callback;
                this.callback = null;
                callback(result);
            }
        }
    },

    start: function(text, spinner, callback) {
        this.os.addObserver(serviceObserver, "foxmarks-service", false);
        this.text = text;
        this.spinner = spinner;
        this.callback = callback;
        if (this.spinner) {
            this.spinner.hidden = false;
        }
    }
}

function FetchProfileNames(text, spinner, menuPopup, callback) {
    var fms = Cc["@foxcloud.com/extensions/foxmarks;1"].
        getService(Ci.nsIFoxmarksService);
    serviceObserver.start(text, spinner, FetchProfileNamesCallback);
    if (!fms.getProfileNames()) {
        callback({status: 2, msg: "Whoops! We're busy!" });
    }

    function FetchProfileNamesCallback(response) {
        if (response.profiles) {
            var profiles = response.profiles;
            var count = 0;
            for (var i = 1; i < menuPopup.childNodes.length; ++i) {
                if (profiles[String(i)]) {
                    var name = profiles[String(i)];
                    menuPopup.childNodes[i].label = name;
                    menuPopup.childNodes[i].hidden = false;
                    count++;
                } else {
                    menuPopup.childNodes[i].hidden = true;
                }
            }
            if (callback) {
                callback({ status: response.status, count: count, 
                        profiles: profiles });
            }
        }
    }
}

function VerifyPINStatus(pin, text, spinner, callback) {
    var fms = Cc["@foxcloud.com/extensions/foxmarks;1"].
        getService(Ci.nsIFoxmarksService);
    serviceObserver.start(text, spinner, callback);
    fms.verifypin(pin);
}

function FetchAccountStatus(syncType, text, spinner, callback) {
    var fms = Cc["@foxcloud.com/extensions/foxmarks;1"].
        getService(Ci.nsIFoxmarksService);
    serviceObserver.start(text, spinner, callback);
    fms.status(syncType);
}

function FetchAccountExtStatus(syncType, text, spinner, callback) {
    var fms = Cc["@foxcloud.com/extensions/foxmarks;1"].
        getService(Ci.nsIFoxmarksService);
    serviceObserver.start(text, spinner, callback);
    fms.extstatus(syncType);
}

var inputTimer;
function handlePasswordMeter(id){
    if(inputTimer){
        window.clearTimeout(inputTimer);
        inputTimer = undefined;
    }

    inputTimer = window.setTimeout(function(){
        var txt = document.getElementById(id).value;
        var result = TestPassword(txt);

        if(result * 5 > 200 || result > 24){
            result = 40;
        }
        document.getElementById('passwordmeter').width = result * 5;
        if(txt.length < 4){
            document.getElementById('passwordStrength').style.color = 
                "#333";
            document.getElementById('passwordmeter').style.backgroundColor = 
                "#999";

            document.getElementById('passwordStrength').value =
                Bundle().GetStringFromName("password.tooshort");
        }
        else if(result < 17){
            document.getElementById('passwordStrength').value =
                Bundle().GetStringFromName("password.weak");
            document.getElementById('passwordStrength').style.color = 
                "#57040F";
            document.getElementById('passwordmeter').style.backgroundColor = 
                "#57040F";
        }
        else if(result < 24){
            document.getElementById('passwordStrength').value =
                Bundle().GetStringFromName("password.good");
            document.getElementById('passwordStrength').style.color = 
                "#ED9D2B";
            document.getElementById('passwordmeter').style.backgroundColor = 
                "#ED9D2B";
        }
        else {
            document.getElementById('passwordStrength').value =
                Bundle().GetStringFromName("password.strong");
            document.getElementById('passwordStrength').style.color = 
                "#2A911B";
            document.getElementById('passwordmeter').style.backgroundColor = 
                "#2A911B";

        }
        inputTimer = undefined;
        /*
        if(window)
            window.sizeToContent();

        */
    }, 500);
}
