/* 
 Copyright 2008 Foxmarks Inc.

 foxmarks-changeprofile.js: Implements actions for change profile dialog.

 */

function ChangeProfileLoad() {
    PasswordChange.password = gSettings.password;
    if (!PasswordChange.password) {
        window.close();
        return;
    }

    var menuPopup = document.getElementById("profileMenuPopup");
    
    if (gSettings.viewId) {
        menuPopup.childNodes[gSettings.viewId].label = gSettings.viewName;
        menuPopup.childNodes[gSettings.viewId].hidden = false;
    }

    document.getElementById("profileMenuList").value = gSettings.viewId;
}

function PasswordChange() {
    var passwordElement = document.getElementById("password");
    if (passwordElement.value == PasswordChange.password) {
        passwordElement.disabled = true;
        gSettings.ClearCredentials();
        LoadProfileNames();
    }
}

function LoadProfileNames() {
    FetchProfileNames(null, document.getElementById("profileSpinner"),
        document.getElementById("profileMenuPopup"), NamesLoaded);
    document.getElementById("profileMenuList").value = String(gSettings.viewId);
}

function NamesLoaded(response) {
    if (response.count) {
        document.getElementById("profileMenuList").disabled = false;
        document.getElementById("profileMenuList").focus();
    }
}

function ChangeProfileOK() {
    window.arguments[0].newProfileId = 
        document.getElementById("profileMenuList").value;
    window.arguments[0].newProfileName =
        document.getElementById("profileMenuList").label;
    return true;
}

