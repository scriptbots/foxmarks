/* 
 Copyright 2005-2008 Foxmarks Inc.
 
 foxmarks-setup.js: implements behavior for the Foxmarks Setup Wizard.
   
 */


var gIsEmpty;
var gHasProfiles;
var pProfileNames;
var gWizardSession = Date.now().toString(36);
var gHelpUrl;
var gPasswordsNeedUpload = false;

var gWizardMode = "normal";
var gWizardForgotPassword = false;

function OnWizardCancel() {
    if(gWizardMode == "normal"){
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
    else
        return true;
}
function OnWizardLoad(){
    var wizard = document.documentElement;
    var sb = Bundle();
    if(window.arguments[1] !== undefined)
        gWizardMode = window.arguments[1];
    else
        gWizardMode = "normal";

    if(gWizardMode == "resetPIN"){
        wizard.title = sb.GetStringFromName("wizard.resettitle");
        wizard.goTo("resetPIN");
    }
    else if(gWizardMode == "askforPIN"){
        wizard.title = sb.GetStringFromName("wizard.newtitle");
        wizard.goTo("passwordTransition");
    }
}

function HandleError(retval) {
    var wizard = document.documentElement;
    wizard.goTo("errorPage");
    document.getElementById("errormsg").value = retval.msg;
    var errmsg = retval.msg.replace(/ /g, "_");
    gHelpUrl = Bundle().formatStringFromName("url.error", [errmsg], 1);
    wizard.canAdvance = true;
}

function OnTransitionPageShow() {
    /*

    We've just gained control back from the web-based setup wizard.
    1) Confirm that we can log in.
    2) Determine whether there are profiles.
    3) Determine whether there are server-side bookmarks.

    */
    // There is a timing issue; sometimes this doesn't get called first
    OnWizardLoad();
    if(gWizardMode != "normal")
        return;

    var spinner = document.getElementById("spinner");
    var status = document.getElementById("statusLabel");
    var wizard = document.documentElement;
    wizard.canAdvance = false;
    document.getElementById("profileMenuList").value = String(gSettings.viewId);

    FetchAccountStatus("bookmarks", status, spinner, FetchedStatus);

    function FetchedStatus(response) {
        if (response.status != 0) {
            HandleError(response);
            return;
        }

        gIsEmpty = response.isreset == "true" || response.isreset == true;

        if("@mozilla.org/login-manager;1" in Components.classes){
            wizard.getPageById("selectProfile").next = "syncPasswords";
        }
        else {
            wizard.getPageById("selectProfile").next = gIsEmpty ? 
                "execute" : "selectSyncOption"; 
        }

        FetchProfileNames(status, spinner,
            document.getElementById("profileMenuPopup"),
            FetchedProfileNames);
    }

    function FetchedProfileNames(response) {
        if (response.status != 0) {
            HandleError(response);
            return;
        }

        gHasProfiles = (response.count > 0);
        gProfileNames = response.profiles;
        // TODO: what should we do with this haveSynced
        wizard.getPageById("transition").next = 
            (gHasProfiles && !gSettings.haveSynced) ?
            "selectProfile" : wizard.getPageById("selectProfile").next;
        wizard.canAdvance = true;
        if(gWizardMode == "normal")
            wizard.advance();
    }
}

function ForgotPIN(){
    var wizard = document.documentElement;

    wizard.goTo("forgotPIN");
}

function ForgotPINAdvance(){
    var wizard = document.documentElement;
    var resetPIN  = document.getElementById("forgotpinradio").selectedItem.value == "reset";
    if(resetPIN){
        wizard.currentPage.next = "resetPIN";
    }
    else {
        gSettings.setSyncEnabled("passwords", false);
        wizard.currentPage.next = gIsEmpty ? 
            "execute" : "selectSyncOption"; 
    }
    return true;
}
function ForgotPINRewind(){
    var wizard = document.documentElement;
    wizard.goTo('pinOld'); 
    return false;
}

function ResetPINLoad(){
    if(gWizardMode == "resetPIN"){
        var wizard = document.documentElement;
        var radio = document.getElementById("resetpinno");
        radio.label = Bundle().GetStringFromName("wizard.changedmymind");
        wizard.canAdvance = true;
        wizard.canRewind = false;
    }
}

function SyncPasswordsLoad(){
    var wizard = document.documentElement;
    wizard.canRewind = false;

}
function ResetPINRewind(){
    var wizard = document.documentElement;
    wizard.goTo('forgotPIN'); 
    return false;
}

function ResetPINAdvance(){
    var wizard = document.documentElement;
    var resetPIN  =
        document.getElementById("resetpinradio").selectedItem.value == "1";
    if(resetPIN){
       gSettings.setMustUpload("passwords", true);
       gWizardForgotPassword = true;
        wizard.currentPage.next = "pinNew";
    }
    else {
        if(gWizardMode == "normal"){
            gSettings.setSyncEnabled("passwords", false);
            wizard.currentPage.next = gIsEmpty ? 
                "execute" : "selectSyncOption"; 
        }
        else {
            wizard.cancel();
        }
    }
    return true;

}
function SyncPasswordAdvance() {
    var wizard = document.documentElement;
    var syncPassword =
        document.getElementById("syncpasswordradio").selectedItem.value == "1";
    if(syncPassword){
        wizard.currentPage.next = "passwordTransition";
    }
    else {
        gSettings.setSyncEnabled("passwords", false);
        wizard.currentPage.next = gIsEmpty ? 
            "execute" : "selectSyncOption"; 
    }
    return true;
}

function OnPasswordTransitionPageShow() {
    var spinner = document.getElementById("pin_spinner");
    var status = document.getElementById("pin_statusLabel");
    var wizard = document.documentElement;
    wizard.canAdvance = false;

    FetchAccountExtStatus("passwords", status, spinner,function(response){ 
        if (response.status != 0) {
            HandleError(response);
            return;
        }

        gPasswordsNeedUpload = response.ispurged;
        wizard.currentPage.next = response.isreset == "true" ||
            response.isreset == true || response.ispurged == true ?
            "pinNew" :
            "pinOld";

        wizard.canAdvance = true;
        wizard.advance();
    });
}

function NewPINRewind(){
    if(gWizardMode == "resetPIN"){
        var wizard = document.documentElement;
        wizard.goTo("resetPIN");
        return false;
        
    }
    else if(gWizardForgotPassword){
        gWizardForgotPassword = false;       
        var wizard = document.documentElement;
        wizard.goTo("resetPIN");
        return false;
    }

    return GotoSyncPasswords();

}
function OldPinLoad(){
    if(gWizardMode == "askforPIN"){
        var wizard = document.documentElement;
        wizard.canRewind = false;
    }
}
function NewOrResetPassword(){
    var wizard = document.documentElement;
    var currpin = gSettings.pinNoPrompt;
    if(currpin){
        if(gWizardMode == "resetPIN"){
            wizard.currentPage.label =
                Bundle().GetStringFromName("wizard.resetpintitle");
        }
        else {
            wizard.currentPage.label =
                Bundle().GetStringFromName("wizard.newpintitle");
        }
        wizard.currentPage.next = "resetpinVerified";
    }
    else if(gWizardMode == "askforPIN"){
        wizard.canRewind = false;
    }
}

function NewPasswordAdvance(){
    var wizard = document.documentElement;
    var pin = document.getElementById("newpin").value;
    var pin2 = document.getElementById("newpin2").value;

    if(!pin || pin.length < 4 || pin.length > 255){
        FoxmarksAlert(Bundle().GetStringFromName("error.pinWrongSize"));
        return false;
    }

    if(!pin2 || pin != pin2){
        FoxmarksAlert(Bundle().GetStringFromName("error.pinNoMatch"));
        return false;
    }

    if(pin == gSettings.password){
        FoxmarksAlert(Bundle().GetStringFromName("error.pinEqualsPassword"));
        return false;
    }

    gSettings.pin = pin;
    gSettings.rememberPin = document.getElementById("rememberPin").checked;

    gSettings.setSyncEnabled("passwords", true);
    if(gPasswordsNeedUpload){
        gSettings.setMustUpload("passwords", true);
    }
    gWizardForgotPassword = false;       
    return true;
}

function OldPinAdvance(){
    gSettings.rememberPin = document.getElementById("rememberPinOld").checked;
    return true;
}
function VerifyPIN(){
    var spinner = document.getElementById("vpin_spinner");
    var status = document.getElementById("vpin_statusLabel");
    var wizard = document.documentElement;
    var pin = document.getElementById("oldpin").value;
    wizard.canAdvance = false;

    if(!pin || pin.length < 4 || pin.length > 255){
        FoxmarksAlert(Bundle().GetStringFromName("error.pinWrongSize"));
        wizard.canAdvance = true;
        wizard.rewind();
        return;
    }

    VerifyPINStatus(pin, status, spinner,function(response){ 
        if (response.status != 0) {
            FoxmarksAlert(Bundle().GetStringFromName("error.pinInvalid"));
            wizard.canAdvance = true;
            wizard.rewind();
            return;
        }

        gSettings.pin = pin;

        var lm = Date.now();
        if (!this.lastModified || lm > this.lastModified) {
            this.lastModified = lm;
            var os = Cc["@mozilla.org/observer-service;1"]
                .getService(Ci.nsIObserverService);
            os.notifyObservers(null, "foxmarks-datasourcechanged", 
                lm + ";passwords");
        }

        wizard.canAdvance = true;
        wizard.advance();
    });
}
function PinVerifiedAdvance(){
    gSettings.setSyncEnabled("passwords", true);
    if(gPasswordsNeedUpload){
        gSettings.setMustUpload("passwords", true);
    }
    if(gWizardMode == "normal")
        return true;
    else {
        window.arguments[2].doSync = true;
        window.close();
    }
    return true;
}

function GotoSyncPasswords(){
    var wizard = document.documentElement;
    wizard.goTo("syncPasswords");
    return false;
}
function RelinkPinVerified(){
    var wizard = document.documentElement;
    if(gWizardMode == "normal"){
        wizard.currentPage.next = gIsEmpty ? 
            "execute" : "selectSyncOption"; 
        }
    else {
        var button = wizard.getButton('next');
        button.label = Bundle().GetStringFromName("wizard.finished");
        button.accesskey = Bundle().GetStringFromName("wizard.finished.accesskey");
        button = wizard.getButton('cancel');
        button.hidden = true;
        button.disabled =true;
        button = wizard.getButton('back');
        button.hidden = true;
        button.disabled =true;
    }
}

function NewPinVerifiedAdvance(){
    if(gWizardMode == "normal")
        return true;
    else {
        window.arguments[2].doSync = true;
        window.close();
    }
    return true;
}

function SetProfileValue() {
    LogWrite("Setting profile value...");
    gSettings.viewId = document.getElementById("profileMenuList").value;
    gSettings.viewName = document.getElementById("profileMenuList").label;
    LogWrite("Profle value is now " + gSettings.viewId);
}

function SyncOptionAdvance() {
    var wizard = document.documentElement;
    wizard.currentPage.next = SetupIsMerging() ? "mergeOption" : "execute";
    return true;
}

function FoxmarksSetupHelp() {
    if (gHelpUrl) {
        FoxmarksOpenInNewWindow(gHelpUrl);
    }
}

function SetupIsMerging() {
    return !gIsEmpty && 
        document.getElementById("localOrRemote").selectedItem.value == "merge";
}
// Skip over merge options if the user hasn't selected merge.
function SetupOptionNext() {
    document.documentElement.getPageById("selectSyncOption").next = 
        SetupIsMerging() ? "mergeOption" : "execute";
    return true;
}

function SetupShowExecutePage() {
    var op;
    var a = document.getElementById("localOrRemote").selectedItem.value;
    var b = document.getElementById("mergeStart").selectedItem.value;
    var desc = document.getElementById("readydesc");

    if(gSettings.isSyncEnabled("passwords"))
        desc.setAttribute("value", Bundle().
        GetStringFromName("label.syncinitial"));

    if (gIsEmpty) {
        op = "msg.upload";
    } else {
        if (a == "local") {
            op = "msg.upload";
        } else if (a == "remote") {
            op = "msg.download";
        } else {
            if (b == "local") {
                op = "msg.mergelocal";
            } else {
                op = "msg.mergeremote";
            }
        }
    }
    document.getElementById("operation").value = Bundle().GetStringFromName(op);
    var warning = document.getElementById("warning");
    if (!gIsEmpty && a != "merge") {
        warning.value = Bundle().GetStringFromName(op + ".warning");
        warning.hidden = false;
    } else {
        warning.hidden = true
    }
    var profileMsg = document.getElementById("profileMsg");
    if (gHasProfiles && gSettings.viewId) {
        profileMsg.value = Bundle().formatStringFromName("msg.profilemsg",
            [gProfileNames[String(gSettings.viewId)]], 1);
        profileMsg.hidden = false;
    } else {
        profileMsg.hidden = true;
    }
}

function SetupPerformSync() {
    var retval = {}
    var args = {};

    var a = document.getElementById("localOrRemote").selectedItem.value;
    var b = document.getElementById("mergeStart").selectedItem.value;

    args.merge = SetupIsMerging();
    args.remoteIsMaster = gIsEmpty ? false :
        (args.merge ? (b == "remote") : (a == "remote"));

    if(gSettings.isSyncEnabled("passwords"))
        gSettings.securityLevel = 1;
    SetupPerformAction("initialSync", retval, args);

    if (!retval.status) {
        return true;
    } else {
        FoxmarksAlert(Bundle().formatStringFromName("msg.syncfailed",
                [retval.msg], 1));
    }

    return false;
}

function SetupPerformAction(action, retval, args) {
    var win = window.
            openDialog("chrome://foxmarks/content/foxmarks-progress.xul",
            "_blank", "chrome,dialog,modal,centerscreen", action, retval, args);

    if (retval.helpurl) {
        openDialog("chrome://browser/content/browser.xul", "_blank",
            "chrome,all,dialog=no", retval.helpurl);
        retval.status = -1;
        retval.msg = Bundle().GetStringFromname("msg.cancelled");
    }

    return;
}

function SetupOnWizardFinish() {
    gSettings.majorVersion = 2;
    var fms = Cc["@foxcloud.com/extensions/foxmarks;1"].
        getService(Ci.nsIFoxmarksService);
    fms.launchSuccessPage();
    return true;
}

function OnPageShow(pageId) {
    var attrs = [];
    attrs.push("app="       + "jezebel");
    attrs.push("mid="       + gSettings.machineId);
    attrs.push("sess="      + gWizardSession);
    attrs.push("page="      + pageId);
    attrs.push("username="  + gSettings.username);
    attrs.push("no_cache="  + Date.now().toString(36));
    attrs.push("manual="    + window.arguments[0]);

    var query = attrs.join("&");
    var img = document.getElementById(pageId + "Ping");
    img.src = gSettings.httpProtocol + "tr.foxmarks.com/tracking/impressions.gif?" + query;
}
function FoxmarksMoreSecurityInfo(){
    window.openDialog(
        "chrome://foxmarks/content/foxmarks-moresecurityinfo.xul",
        "_blank",
        "chrome,dialog,modal,centerscreen"
    );
}
