



Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

try {
    Components.utils.import("resource://imacros/utils.js");
} catch(e) {
    dump("ex"+e.toString()+"\n");
}



const Cc = Components.classes;
const Ci = Components.interfaces;



const nsISupports         = Ci.nsISupports;
const nsIContentPolicy    = Ci.nsIContentPolicy;
const nsIChannelEventSink = Ci.nsIChannelEventSink;
const nsIObserver         = Ci.nsIObserver;
const nsIObserverService  = Ci.nsIObserverService;
const nsITimer            = Ci.nsITimer;
const nsICommandLine      = Ci.nsICommandLine;
const nsIWindowWatcher    = Ci.nsIWindowWatcher;
const nsICommandLineHandler = Ci.nsICommandLineHandler;

const NS_BINDING_ABORTED = Components.results.NS_BINDING_ABORTED;



 
 
 



const WATCHER_CLASS_ID = Components.ID("{e4a28173-828d-486e-937c-4c8e4d7a8511}");

const WATCHER_CLASS_NAME = "iMacros Request Watcher";

const WATCHER_CONTRACT_ID = "@iopus.com/requestwatcher;1";




function RequestWatcher() {
    
    this.wrappedJSObject = this;
    
    this.isListLoaded = false;
    this.whiteList = null;
    this.filterImages = false;
    this.runPattern = new RegExp('^imacros://run/\\?(code|m)=(.*)');
    const im_strre = "(?:[^\"\\\\]|\\\\[0btnvfr\"\'\\\\])+";
    this.jsPattern = new RegExp('^javascript:\\(function\\(\\) '+
                     '\\{(?:try\\{)?var ((?:e_)?m(?:64)?) = "('+im_strre+')"'+
                     ', n(?:64)? = "('+im_strre+')";');
}



RequestWatcher.prototype = {
    
    classDescription: WATCHER_CLASS_NAME,  
    classID:          WATCHER_CLASS_ID,
    contractID:       WATCHER_CONTRACT_ID,

    
    _xpcom_categories: [
        {  
            category: "content-policy",
            entry: WATCHER_CONTRACT_ID
        },
        {  
            category: "net-channel-event-sinks",
            entry: WATCHER_CONTRACT_ID,
        }
    ],
    
    
    enableImageFilter: function(enable) {
        if (typeof enable == "undefined" || enable)
            this.filterImages = true;
        else if (!enable)
            this.filterImages = false;
    },
    
    
    
    querySite: function(site) {
        if (!this.isListLoaded)
            this.loadList();
        return site in this.whiteList;
    },

    
    addSite: function(site) {
        if (!this.isListLoaded)
            this.loadList();
        this.whiteList[site] = true;
        this.saveList();
    },

    
    blockSite: function(site) {
        if (!this.isListLoaded)
            this.loadList();
        this.whiteList[site] = false;
        this.saveList();
    },

    
    
    removeSite: function(site) {
        if (!this.isListLoaded)
            this.loadList();

        if (site in this.whiteList)
            delete this.whiteList[site];
        this.saveList();
    },


    
    enumerateSites: function() {
        if (!this.isListLoaded)
            this.loadList();
        
        
        return this.whiteList;
    },


    
    loadList: function() {
        try {
            var list = imns.Pref.getCharPref("white-list");
            this.whiteList = list && /{.*}/.test(list) ? eval(list) : {};
        } catch (e) {
            this.whiteList = {};
            this.saveList();
        } finally {
            this.isListLoaded = true;
        }
    },


    
    saveList: function() {
        imns.Pref.setCharPref("white-list", this.whiteList.toSource());
    },



    
    shouldBlockURI: function (origin, location) {
        var isJS = location.scheme == "javascript";
        var url = decodeURIComponent(location.spec);
        var match = isJS ? this.jsPattern.exec(url) :
            this.runPattern.exec(url);
        if( !match )
            return false;
        var retobj = new Object();
        
        if (isJS) {
            retobj.type = "bookmarklet";
            retobj.data = match[1] == "m" ?
                imns.unwrap('"'+match[2]+'"') :
                decodeURIComponent(atob(match[2]));
            retobj.name = /64$/.test(match[1]) ?
                decodeURIComponent(atob(match[3])) : match[3];
        } else {
            retobj.type = match[1];
            retobj.data = match[2];
            if (match[1] == "m" && /\/?([^\/]*)$/.test(match[2]))
                retobj.name = RegExp.$1;
        }
        
        if (!origin) {
            retobj.grant = false;
            retobj.origin = "unknown";
        }

        if (origin.schemeIs("file") || origin.schemeIs("chrome")) {
            retobj.grant = true;
            retobj.origin = "local";
        } else {
            retobj.origin = origin.host;
            if (!this.querySite(origin.host)) 
                retobj.grant = false;
            else if (this.whiteList[origin.host])
                retobj.grant = true;
            else {   
                return true;
            }
        }
        var wm = imns.Cc["@mozilla.org/appshell/window-mediator;1"]
            .getService(imns.Ci.nsIWindowMediator);
        var win = wm.getMostRecentWindow("navigator:browser");
        this.osvc.notifyObservers(win, "imacros-runmacro",
                                  JSON.stringify(retobj));
        return true;
    },
    

    
    shouldLoad: function(type, location, origin, ctx, mime, extra) {
        if (type == nsIContentPolicy.TYPE_DOCUMENT) {
            return this.shouldBlockURI(origin, location) ?
                nsIContentPolicy.REJECT_REQUEST : nsIContentPolicy.ACCEPT;

        } else if (type == nsIContentPolicy.TYPE_OBJECT) {
            if (this.filterImages) {
                
                if (/^application\/x-shockwave-flash$/.test(mime) ||
                    /\.swf$/i.test(location.spec))
                    return nsIContentPolicy.REJECT_REQUEST;
            }
        } else if (type == nsIContentPolicy.TYPE_IMAGE) {
            if (this.filterImages) {
                
                if (/^chrome:\/\//.test(location.spec) ||
                    /favicon\.ico$/.test(location.spec) )
                    return nsIContentPolicy.ACCEPT;
                return nsIContentPolicy.REJECT_REQUEST;
            }
        } 

        return nsIContentPolicy.ACCEPT;
    },

    shouldProcess: function(type, location, origin, ctx, mime, extra) {
        return nsIContentPolicy.ACCEPT;
    },
    

    
    onChannelRedirect: function(old_channel, new_channel, flags) {
    },

    
    asyncOnChannelRedirect: function(oldc, newc, flags, cb) {
        this.onChannelRedirect(oldc, newc, flags);
        cb.onRedirectVerifyCallback(0);
    },

    
    
    get osvc() {
        var os = Cc["@mozilla.org/observer-service;1"];
        return os.getService(nsIObserverService);
    },

    
    
    QueryInterface: function(iid) {
        if (iid.equals(nsISupports) ||
            iid.equals(nsIContentPolicy) ||
            iid.equals(nsIChannelEventSink))
            return this;

        throw Components.results.NS_ERROR_NO_INTERFACE;
    }
        
};




 
 
 



const IMPROTO_CLASS_ID = Components.ID("{d32d50cf-ec60-4758-b945-44e208f27120}");

const IMPROTO_CLASS_NAME = "iMacros Protocol Handler";

const IMPROTO_CONTRACT_ID = "@mozilla.org/network/protocol;1?name=imacros";





function iMacrosProtocol() {
    this.protocolFlags = Ci.nsIProtocolHandler.URI_NORELATIVE |
        Ci.nsIProtocolHandler.URI_NOAUTH;
    
    if (Ci.nsIProtocolHandler.URI_LOADABLE_BY_ANYONE)
        this.protocolFlags |= Ci.nsIProtocolHandler.URI_LOADABLE_BY_ANYONE;
}



iMacrosProtocol.prototype = {
    
    classDescription: IMPROTO_CLASS_NAME,
    classID:          IMPROTO_CLASS_ID,
    contractID:       IMPROTO_CONTRACT_ID,

    
    scheme: "imacros",
    defaultPort: -1,
    
    allowPort: function(port, scheme) {
        return false;
    },

    newURI: function(spec, charset, baseURI) {
        var uri = Cc["@mozilla.org/network/simple-uri;1"].
            createInstance(Ci.nsIURI);
        uri.spec = spec;

        return uri;
    },


    newChannel: function (uri) {
        
        var ios = Cc["@mozilla.org/network/io-service;1"].
            getService(Ci.nsIIOService);

        return ios.newChannel("javascript:void", null, null);
    },
    
    
    
    get osvc() {
        var os = Cc["@mozilla.org/observer-service;1"];
        return os.getService(nsIObserverService);
    },

    
    QueryInterface: function(iid) {
        if (!iid.equals(Ci.nsIProtocolHandler) &&
            !iid.equals(nsISupports))
            throw Components.results.NS_ERROR_NO_INTERFACE;
        return this;
    }
    
};




  
  
  
  


const STORAGE_CLASS_ID = Components.ID("{40048f63-da21-4398-bf21-5bdecac8869f}");

const STORAGE_CLASS_NAME = "iMacros Temporary Storage";

const STORAGE_CONTRACT_ID = "@iopus.com/storage;1";



function iMacrosStorage() {
    
    this.wrappedJSObject = this;
    this.m_namedObject = new Object();
    this.m_namedObject.global = new Object();
}


iMacrosStorage.prototype = {
    
    classDescription: STORAGE_CLASS_NAME,
    classID:          STORAGE_CLASS_ID,
    contractID:       STORAGE_CONTRACT_ID,

    get namedObject() {
        return this.m_namedObject;
    },

    hasNamedObject: function (name) {
        try {
            return this.m_namedObject.global &&
                this.m_namedObject.global.hasOwnProperty(name);
        } catch(e) {
            return false;
        }
    },

    getNamedObject: function (name) {
        if (!this.hasNamedObject(name))
            return null;
        return this.m_namedObject["global"][name];
    },

    setNamedObject: function (name, value) {
        this.m_namedObject["global"][name] = value;
    },

    clear: function (name) {
        if (this.hasNamedObject(name))
            delete this.m_namedObject.global[name];
    },
    
    clearAll: function () {
        for (var x in this.m_namedObject.global) {
            this.clear(x);
        }
    },

    getObjectForWindow: function(wid, name) {
        if (!(wid in this.m_namedObject))
            return null;
        return this.m_namedObject[wid][name];
    },
    
    setObjectForWindow: function(wid, name, value) {
        if (!(wid in this.m_namedObject))
            this.m_namedObject[wid] = new Object();
        this.m_namedObject[wid][name] = value;
    },

    clearWindowObject: function (wid, name) {
        if (name in this.m_namedObject[wid])
            delete this.m_namedObject[wid][name];
    },
    
    
    
    QueryInterface: function(iid) {
        if (iid.equals(nsISupports))
            return this;

        throw Components.results.NS_ERROR_NO_INTERFACE;
    }
    
};










const PM_CLASS_ID = Components.ID("{38f6b153-a27f-473e-98a9-03541bc9979f}");

const PM_CLASS_NAME = "iMacros Password Manager";

const PM_CONTRACT_ID = "@iopus.com/password-manager;1";

const iMacros_auth_host = "chrome://imacros";
const iMacros_auth_desc = "iMacros master password";


function iMacrosPasswordManager() {
    
    this.wrappedJSObject = this;
    this.sessionPassword = null;
}


iMacrosPasswordManager.prototype = {
    
    classDescription: PM_CLASS_NAME,
    classID:          PM_CLASS_ID,
    contractID:       PM_CONTRACT_ID,

     
    getMasterPwd: function() {
        var password = null;
        
        if ("@mozilla.org/passwordmanager;1" in imns.Cc) {
            
            password = this.enquire_pm("master");
        } else if ("@mozilla.org/login-manager;1" in imns.Cc) {
            
            password = this.enquire_lm("master");
        }
        
        
        if (!password) {
            try {
                password = this.gprefs.getCharPref("mastersec");
                password = decodeURIComponent(password);
            } catch (e) {
                
            }
            if (password) {  
                
                this.gprefs.clearUserPref("mastersec");
                
                this.setMasterPwd(password);
            }
        }
        return password;
    },


    
    setMasterPwd: function(password) {
        if ("@mozilla.org/passwordmanager;1" in imns.Cc) {
            
            this.store_pm("master", password);
        } else if ("@mozilla.org/login-manager;1" in imns.Cc) {
            
            this.store_lm("master", password);
        }
    },

    
    getSessionPwd: function() {
        return this.sessionPassword;
    },


    
    setSessionPwd: function(password) {
        this.sessionPassword = password;
    },


    
    get encryptionType() {
        var type = this.TYPE_NONE;
        try {
            
            type = imns.s2i(this.gprefs.getCharPref("cursec"));
            this.gprefs.clearUserPref("cursec");
            this.encryptionType = type;
        } catch (e) {
            
        }
        try {
            type = this.prefs.getIntPref("encryptionType");
        } catch (e) {
            
            this.prefs.setIntPref("encryptionType", this.TYPE_NONE);
        }
        return type;
    },

    set encryptionType(typ) {
        var dummy;
        switch (typ) {
        case this.TYPE_NONE: case this.TYPE_STORED: case this.TYPE_TEMP:
            this.prefs.setIntPref("encryptionType", typ);
            break;
        default:
            this.prefs.setIntPref("encryptionType", this.TYPE_NONE);
        }
    },

    
    get TYPE_NONE()   { return 1; },
    get TYPE_STORED() { return 2; },
    get TYPE_TEMP()   { return 3; },


    
    
    
    get prefs() {
        var prefsvc = Components.classes["@mozilla.org/preferences-service;1"].
	  getService(Components.interfaces.nsIPrefService);
	return prefsvc.getBranch("extensions.imacros.");
    },
    
    
    get gprefs() {
        var prefsvc = Components.classes["@mozilla.org/preferences-service;1"].
	  getService(Components.interfaces.nsIPrefService);
	return prefsvc.getBranch(null);
    },

    
    get pm() {
        return imns.Cc["@mozilla.org/passwordmanager;1"].
          getService(imns.Ci.nsIPasswordManager);
    },

    
    get lm() {
        return imns.Cc["@mozilla.org/login-manager;1"].
          getService(imns.Ci.nsILoginManager);
    },
    
    
    enquire_pm: function (user) {
        var e = this.pm.enumerator;
        while (e.hasMoreElements()) {
            var pass = e.getNext().
                QueryInterface(imns.Ci.nsIPassword);
            if (pass.host == iMacros_auth_host && pass.user == user) {
                return pass.password;
            }
        }
        return null;
    },

    
    enquire_lm: function(user) {
        var logins = this.lm.findLogins({}, iMacros_auth_host,
                                        iMacros_auth_desc, null);
        for (var i = 0; i < logins.length; i++) {
            if (logins[i].username == user) {
                return logins[i].password;
            }
        }
        return null;
    },

    
    store_pm: function(user, password) {
        this.pm.addUser(iMacros_auth_host, user, password);
    },

    
    store_lm: function(user, password) {
        var nsLoginInfo = new Components.
         Constructor("@mozilla.org/login-manager/loginInfo;1",
                     imns.Ci.nsILoginInfo, "init");
        var login = new nsLoginInfo(iMacros_auth_host, iMacros_auth_desc,
                                    null, user, password, "", "");
        var logins = this.lm.findLogins({}, iMacros_auth_host,
                                   iMacros_auth_desc, null);
        for (var i = 0; i < logins.length; i++) {
            if (logins[i].username == user) {
                this.lm.modifyLogin(logins[i], login);
                return;
            }
        }
        this.lm.addLogin(login);
    },
    
    
    QueryInterface: function(iid) {
        if (iid.equals(nsISupports))
            return this;

        throw Components.results.NS_ERROR_NO_INTERFACE;
    }
    
};







 
 




const CLHANDLER_CLASS_ID = Components.ID("{5d5a54d9-729b-40a2-b876-3462a09eb4b8}");

const CLHANDLER_CLASS_NAME = "iMacros Command line handler";

const CLHANDLER_CONTRACT_ID = "@iopus.com/cmdlinehandler;1";




function CmdlineHandler() {
    
    this.wrappedJSObject = this;
}



CmdlineHandler.prototype = {

    
    classDescription: CLHANDLER_CLASS_NAME,
    classID:          CLHANDLER_CLASS_ID,
    contractID:       CLHANDLER_CONTRACT_ID,

    _xpcom_categories: [
        {  
            category: "command-line-handler",
            entry: CLHANDLER_CONTRACT_ID
        }
    ],
    
    
    handle: function ( cl) {
        try {
            var sicmd = imns.Cc["@iopus.com/sicmdlistener;1"].
                  getService(imns.Ci.nsISupports).wrappedJSObject;

            var pipe = cl.handleFlagWithParam("im-pipe", true);
            if (pipe) {
                sicmd.initWithPipe(pipe);
            } else {
                
                
                var ds = Cc["@mozilla.org/file/directory_service;1"];
                  ds = ds.getService(Ci.nsIProperties);
                var s = ds.get("ProfD", Ci.nsILocalFile).leafName;
                s = s.replace(/^\w+\./, ""); 
                sicmd.initWithPipe(s);
            }
            
            
        } catch (e) {
            Components.utils.reportError(e);
        }
    },

    helpInfo : " -im-pipe <pipe_name>  Set pipe for iMacros Scripting Interface\n",

    
    QueryInterface: function(iid) {
        if (iid.equals(nsISupports) ||
            iid.equals(nsICommandLineHandler)) 
            return this;

        throw Components.results.NS_ERROR_NO_INTERFACE;
    }
        
};




 
 
 



const SICMDLISTENER_CLASS_ID = Components.ID("{b7077add-ce38-40a6-82c8-eddbeaed99b0}");

const SICMDLISTENER_CLASS_NAME = "iMacros SI Command Listener";

const SICMDLISTENER_CONTRACT_ID = "@iopus.com/sicmdlistener;1";




function SICmdListener() {
    
    this.wrappedJSObject = this;
    this.clients = new Object();
}



SICmdListener.prototype = {
    
    classDescription: SICMDLISTENER_CLASS_NAME,
    classID:          SICMDLISTENER_CLASS_ID,
    contractID:       SICMDLISTENER_CONTRACT_ID,

    _xpcom_categories: [
        {  
            category: "app-startup",
            entry: SICMDLISTENER_CONTRACT_ID,
            service: true
        }
    ],

    
    get osvc() {
        var os = Cc["@mozilla.org/observer-service;1"];
        return os.getService(nsIObserverService);
    },


    get worker() {
        if (!this.m_worker) {
            try {
                var libpath = this.getLibPath();
                if (!libpath) 
                    return null;
                
                if (Ci.nsIWorkerFactory) {
                    var workerFactory = Cc["@mozilla.org/threads/workerfactory;1"]
                        .createInstance(Ci.nsIWorkerFactory);
	            this.m_worker = workerFactory.newChromeWorker("chrome://imacros/content/si_main.js");
                } else {
                    this.m_worker = new ChromeWorker("chrome://imacros/content/si_main.js");
                }
                this.m_worker.onerror = function(e) {
                    Components.utils.reportError(e);
                };

                this.m_worker.onclose = function(evt) {
                    
                };

                var si = this;
                this.m_worker.onmessage = function(evt) {
                    
                    si.onMessage(evt);
                };

                this.m_worker.postMessage({
                    "command":  "init",
                    "libpath":  libpath
                });
            } catch(e) {
                Components.utils.reportError(e);
                return null;
            }
        } 

        return this.m_worker;
    },


    getLibPath: function() {
        var path;
        if (imns.is_windows()) {
            
            var wrk = imns.Cc["@mozilla.org/windows-registry-key;1"]
                    .createInstance(imns.Ci.nsIWindowsRegKey);
            try {
                wrk.open(wrk.ROOT_KEY_LOCAL_MACHINE,
                         "SOFTWARE\\iOpus\\iMacros",
                         wrk.ACCESS_READ);
            } catch(e) {
                
                return "";
            }
            path = wrk.readStringValue("PathExe");
            wrk.close();
            var node = imns.FIO.openNode(path);
            if (!node.isDirectory()) {
                Components.utils.reportError(
		    new Error("iMacros: can not find iimFirefoxConnector!")
		);
                return "";
            }
            node.append("iimFirefoxConnector.dll");
            if (!node.exists()) {
                Components.utils.reportError("Can not find connector library!");
                return "";
            }
            path = node.path;
        } else {
            var is_64bit = false;
            try {
                var os = Components.classes["@mozilla.org/xre/app-info;1"]
                  .getService(Components.interfaces.nsIXULRuntime);
                is_64bit = /^x86_64/i.test(os.XPCOMABI);
            } catch(ex) {
            }
            
            
            var ds = Cc["@mozilla.org/file/directory_service;1"];
            ds = ds.getService(Ci.nsIProperties);
            var libpath = ds.get("Home", Ci.nsILocalFile);
            libpath.append("iMacros");
            libpath.append(is_64bit ? "iimFirefoxConnector64.so" : "iimFirefoxConnector.so");
            if(libpath.exists() && libpath.isFile()) {
                path = libpath.path;
            } else {
                return "";
            }
        }
        
        return path;
    },
    

    sendResponse: function(clientId, message, errorCode, extra) {
        
        
        
        
        if (errorCode < 0 && !/error\: /i.test(message)) {
            message = "Error: "+message;
        }
        message += " ("+errorCode+")";
        
        var result = {
            status: message,
            errorCode: errorCode,
            extractData: (extra && extra.extractData) ?
                extra.extractData.split("[EXTRACT]") : "",
            imageData: (extra && extra.imageData) ? extra.imageData : {},
            lastPerformance: extra ? extra.lastPerformance : [],
            waitForProcessId: extra ? extra.waitForProcessId : 0,
            profilerData: extra && extra.profilerData ? extra.profilerData : ""
        };

        
        
        
        var s = JSON.stringify(result);
        s = s.replace(/\\u000a/g, "\\n");
        this.worker.postMessage(
            {"command": "send_response", "clientId": clientId, "response": s}
        );
    },


    
    openBrowserWindow: function (uri) {
        var arg = Cc["@mozilla.org/supports-string;1"]
           .getService(Ci.nsISupportsString);
        arg.data = uri;

        
        var pref_svc = Cc["@mozilla.org/preferences-service;1"]
           .getService(Ci.nsIPrefBranch);
        var chromeURL = pref_svc.getCharPref("browser.chromeURL");

        var ww = Cc["@mozilla.org/embedcomp/window-watcher;1"]
           .getService(Ci.nsIWindowWatcher );
        var win = ww.openWindow(null,
            chromeURL, "_blank", "chrome,dialog=no,all", arg);
        
        return win;
    },

    _save_client: function (clientId, win) {
        this.clients[clientId] = new Object();
        this.clients[clientId].window = win;
        this.clients[clientId].in_use = true;
    },

    onInit: function(clientId, args) {
        try {
            var wm = imns.Cc["@mozilla.org/appshell/window-mediator;1"]
                   .getService(imns.Ci.nsIWindowMediator);
            var win = wm.getMostRecentWindow("navigator:browser");

            if (!win) { 
                this.timer = Cc["@mozilla.org/timer;1"]
                  .createInstance(Ci.nsITimer);
                this.timer.init(this, 200, Ci.nsITimer.TYPE_ONE_SHOT);
                this.saved_clientId = clientId;
                this.saved_args = args;
                
                return;
            }

            if (args.launched) { 
                this._save_client(clientId, win);
                if (!win.iMacros || !win.iMacros.player || !win.iMacros.panel) {
                    win.addEventListener("load", function() {
                        var sicmd = imns.Cc["@iopus.com/sicmdlistener;1"].
                          getService(imns.Ci.nsISupports).wrappedJSObject;
                        sicmd.sendResponse(clientId, "OK", 1);
                    }, false);
                } else {
                    this.sendResponse(clientId, "OK", 1);
                }
            } else {
                if (args.openNewBrowser) {
                    win = this.openBrowserWindow("about:blank");
                    this._save_client(clientId, win);
                    win.addEventListener("load", function() {
                        var sicmd = imns.Cc["@iopus.com/sicmdlistener;1"].
                        getService(imns.Ci.nsISupports).wrappedJSObject;
                        sicmd.sendResponse(clientId, "OK", 1);
                    }, false);

                } else {
                    var windows = wm.getEnumerator("navigator:browser");
                    
                    
                    while(windows.hasMoreElements()) {
                        win = windows.getNext();
                        var found = false;
                        for (var x in this.clients) {
                            if (this.clients[x].window == win &&
                                this.clients[x].in_use) {
                                found = true;
                                break;
                            }
                        }
                        if (!found) {
                            this._save_client(clientId, win);
                            this.sendResponse(clientId, "OK", 1);
                            return;
                        }
                    }

                    
                    win = this.openBrowserWindow("about:blank");
                    this._save_client(clientId, win);
                    win.addEventListener("load", function() {
                        var sicmd = imns.Cc["@iopus.com/sicmdlistener;1"].
                          getService(imns.Ci.nsISupports).wrappedJSObject;
                        sicmd.sendResponse(clientId, "OK", 1);
                    }, false);
                }
            }
        } catch(e) {
            Components.utils.reportError(e);
        }
    },


    onPlay: function(clientId, args) {
        var win = this.clients[clientId].window;
        var play_args = {
            clientId: clientId,
            vars: args.vars,
            use_profiler: args.use_profiler
        };

        if (/^CODE:((?:\n|.)+)$/.test(args.source)) { 
            var val = RegExp.$1;
            val = val.replace(/\[sp\]/ig, ' ');
            val = val.replace(/\[br\]/ig, '\n');
            val = val.replace(/\[lf\]/ig, '\r');
            play_args.type = "source";
            play_args.source = val;
        } else {                
            play_args.type = "file";
            var name = args.source, file = null;
            if (!/\.(?:js|iim)$/i.test(name))
                name += ".iim";
            
            try {
                if (imns.FIO.isFullPath(name)) { 
                    file = imns.FIO.openNode(name);
                } else  {
                    file = imns.FIO.openMacroFile(name);
                }
                if (!file || !file.exists()) {
                    this.sendResponse(clientId, "Can not open macro "+ name,
                                      -931);
                    return;
                }
                play_args.filePath = file.path;
            } catch (xx) {
                Components.utils.reportError(xx);
                this.sendResponse(clientId, "Can not open macro "+ name,
                                  -931);
                return;
            }
        }
        
        this.osvc.notifyObservers(win, "imacros-si-play",
                                  JSON.stringify(play_args));
    },


    onExit: function(clientId, args) {
        var counter = 0;
        var extra = {waitForProcessId: 0};

        try {
            var wm = imns.Cc["@mozilla.org/appshell/window-mediator;1"]
                   .getService(imns.Ci.nsIWindowMediator);

            var windows = wm.getEnumerator("navigator:browser");
            while(windows.hasMoreElements()) {
                var dummy = windows.getNext();
                counter++;
            }

            if (counter == 1) {
                
                
                extra.waitForProcessId = this.pid;
            }

            this.sendResponse(clientId, "OK", 1, extra);
            if (extra.waitForProcessId) {
                this.worker.postMessage({"command": "terminate"});
                delete this.initialized;
            }
            this.clients[clientId].window.BrowserTryToCloseWindow();
            delete this.clients[clientId];
        } catch(e) {
            Components.utils.reportError(e);
        } 
    },
    

    onMessage: function(evt) {
        var msg = evt.data;

        switch (msg.type) {
        case "request":
            this.onRequest(msg.request, msg.clientId);
            break;
        case "error":
            Components.utils.reportError(msg.message);
            break;
        case "message": 
            Components.utils.reportError(msg.message);
            break;
        case "pid":
            this.pid = msg.pid;
            break;
        }
    },
    

    onRequest: function(req, clientId) {
        try {
            var req = JSON.parse(req);
        } catch(e) {
            Components.utils.reportError(e);
            
            this.sendResponse(clientId,
                              "Can not parse request \""+command+"\"", -1);
        }

        try {
            switch(req.type) {
            case "init":
                this.onInit(clientId, req.args);
                break;

            case "play":
                this.onPlay(clientId, req.args);
                break;

            case "exit":
                this.onExit(clientId, req.args);
                break;

            case "show":
                var win = this.clients[clientId].window;
                var show_args = {
                    clientId: clientId,
                    message: req.args.message
                };
                this.osvc.notifyObservers(win, "imacros-si-show",
                                          JSON.stringify(show_args));
                break;

            case "capture":
                var win = this.clients[clientId].window;
                var file;
                try {
                    if (imns.FIO.isFullPath(req.args.path)) {
                        file = imns.FIO.openNode(req.args.path);
                    } else {
                        file = imns.Pref.getFilePref("defdownpath");
                        file.append(req.args.path);
                    }
                } catch(e) {
                    this.sendResponse(clientId,
                                      "RuntimeError: can not open file "+
                                      req.args.path, -932);
                    return;
                }

                var capture_args = {
                    clientId: clientId,
                    filePath: file.path,
                    type: req.args.type
                };
                this.osvc.notifyObservers(win, "imacros-si-capture",
                                          JSON.stringify(capture_args));
                break;

            default:
                this.sendResponse(clientId, "Unknown command "+req.type, -1000);
                break;
            }
        } catch(e) {
            Components.utils.reportError(e);
            this.sendResponse(clientId, e.toString(), -1000);
        }
    },


    initWithPipe: function(pipe) {
        if (!this.worker)
            return;
        
        if (this.m_pipe == pipe)
            return;             
        this.m_pipe = pipe;
        if (this.m_port)
            delete this.m_port;
        this.worker.postMessage(
            {"command": "start", "pipe": pipe}
        );
        this.initialized = true;
    },


    
    observe: function(subject, topic, data) {
        switch(topic) {
        case "profile-after-change":
            this.osvc.addObserver(this, "quit-application-granted", false);
            this.osvc.addObserver(this, "final-ui-startup", false);
            break;

        case "final-ui-startup":
            if (!this.worker)
                return;
            
            if (this.initialized) 
                return;

            try {
                
                
                
                
                
                
                
            } catch(e) {
                Components.utils.reportError(e);
            }
            break;

        case "quit-application-granted":
            this.osvc.removeObserver(this, "quit-application-granted");
            if (!this.worker)
                return;
            try {
                this.worker.postMessage({"command": "terminate"});
            } catch(e) {
                Components.utils.reportError(e);
            }
            break;

        case "timer-callback":
            if (this.timer == subject) {
                this.onInit(this.saved_clientId, this.saved_args);
            }
            break;
        }
    },


    
    QueryInterface: function(iid) {
        if (iid.equals(nsISupports) ||
            iid.equals(nsIObserver))
            return this;

        throw Components.results.NS_ERROR_NO_INTERFACE;
    }

};




var components = [
    RequestWatcher,
    iMacrosProtocol,
    iMacrosStorage,
    iMacrosPasswordManager,
    CmdlineHandler,
    SICmdListener
];



if (XPCOMUtils.generateNSGetFactory)
    
    var NSGetFactory = XPCOMUtils.generateNSGetFactory(
        components,
        function() {}
    );
else
    
    var NSGetModule = XPCOMUtils.generateNSGetModule(
        components,
        function() {}
    );
