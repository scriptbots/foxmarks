/* 
 Copyright 2008 Foxmarks Inc.
 
 foxmarks-resetpin.js: handles the UI for the ResetPIN dialog. 
  
 */

function onResetPINOK()
{
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
    gSettings.setMustUpload("passwords", true);
    window.arguments[0].doSync = true;
    return true;
}

