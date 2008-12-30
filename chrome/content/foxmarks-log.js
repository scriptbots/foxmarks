/* 
 Copyright 2005-2007 Foxmarks Inc.
 
 foxmarks-log.js: provides logging support.
 
 */

function LogWrite(str)
{
    if (gSettings.enableLogging) {
        Components.classes["@foxcloud.com/extensions/foxmarks;1"].
            getService(Components.interfaces.nsIFoxmarksService).logWrite(str);
    }
}
