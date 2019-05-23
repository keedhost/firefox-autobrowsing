









var EXPORTED_SYMBOLS = ["imns"];



var imns = {
    
    compareFxVersion: function(version) {
        var info = imns.Cc["@mozilla.org/xre/app-info;1"]
            .getService(imns.Ci.nsIXULAppInfo);
        var vc = imns.Cc["@mozilla.org/xpcom/version-comparator;1"]
            .getService(imns.Ci.nsIVersionComparator);
        return vc.compare(info.version, version);
    },

    
    strings: function(name) {
        var bundle = imns.Cc["@mozilla.org/intl/stringbundle;1"].
          getService(imns.Ci.nsIStringBundleService).
          createBundle("chrome://imacros/locale/rec.properties");
        try {
            return bundle.GetStringFromName(name);
        } catch (e) {
            Components.utils.reportError("imns.strings() no string "+name);
        }
    },


    
    get storage() {
        var s = null;
        try {
            s = imns.Cc["@iopus.com/storage;1"];
            s = s.getService(imns.Ci.nsISupports);
            return s.wrappedJSObject;
        } catch (e) {
            Components.utils.reportError(e);
            throw "Can't instantiate Storage!";
        }    
    },


    get __win() {
        if (typeof window != "undefined") 
            return window;
        
        var wm = this.Cc["@mozilla.org/appshell/window-mediator;1"]
            .getService(this.Ci.nsIWindowMediator);
        var win = wm.getMostRecentWindow("navigator:browser");
        
        return win ? win.QueryInterface(imns.Ci.nsIDOMWindow) : null;;
    },

    
    getPasswordManager: function() {
        var pm = null;
        try {
            pm = imns.Cc["@iopus.com/password-manager;1"];
            pm = pm.getService(imns.Ci.nsISupports);
            return pm.wrappedJSObject;
        } catch (e) {
            Components.utils.reportError(e);
            throw "Can't instantiate Password Manager!";
        }    
    },


    getEncryptionKey: function() {
        var key = "";
        var pm = this.getPasswordManager();
        
        if (pm.encryptionType == pm.TYPE_NONE) {
            return "";
        } else if (pm.encryptionType == pm.TYPE_STORED) {
            key = pm.getMasterPwd();
        } else if (pm.encryptionType == pm.TYPE_TEMP) {
            key = pm.getSessionPwd();
        }

        if (!key) {
            var param = { password: "", master: false };
            this.__win.openDialog('chrome://imacros/content/keydlg4.xul', '',
                              'modal,centerscreen', param);
            key = param.password;
            if (param.master) {
                pm.setMasterPwd(param.password);
                pm.encryptionType = pm.TYPE_STORED;
            } else {
                pm.setSessionPwd(param.password);
                pm.encryptionType = pm.TYPE_TEMP;
            }
        }
        
        return key;
    },

    
    get Ci() {
        return Components.interfaces;
    },

    get Cc() {
        return Components.classes;
    },

    get Cu() {
        return Components.utils;
    },

    
    get osvc() {
        var os = this.Cc["@mozilla.org/observer-service;1"];
        return os.getService(this.Ci.nsIObserverService);
    },

    
    get prefsvc () {
        var ps = this.Cc["@mozilla.org/preferences-service;1"];
        return ps.getService(this.Ci.nsIPrefService);
    },

    
    get consvc () {
        var cs = this.Cc["@mozilla.org/consoleservice;1"];
        return cs.getService(this.Ci.nsIConsoleService);
    },


    
    __is_windows_int: undefined,

    is_windows: function() {
        if (typeof(this.__is_windows_int) == "undefined") {
            try {
                var os = Components.classes["@mozilla.org/xre/app-info;1"]
                  .getService(Components.interfaces.nsIXULRuntime);
                this.__is_windows_int = os.OS == "WINNT";
            } catch (e) {
                Components.utils.reportError(e);
                this.__is_windows_int =
                    window.navigator.platform.search(/win/i) != -1;
            }
        }
        return this.__is_windows_int;
    },

    is_macosx: function() {
        try {
            var os = Components.classes["@mozilla.org/xre/app-info;1"]
                .getService(Components.interfaces.nsIXULRuntime);
            return os.OS == "Darwin";
        } catch (e) {
            Components.utils.reportError(e);
            return window.navigator.platform.search(/mac/i) != -1;
        }
    },
    
    
    FIO: {
        get psep() {
            return imns.is_windows() ? '\\' : '/';
        },

        
        fixSlashes: function(path) {
            switch(this.psep) {
            case "/":
                return path.replace(/[\\]/g, "/");
            case "\\":
                return path.replace(/\//g, "\\");
            }
            return path;
        },

        isFullPath: function(path) {
            if (imns.is_windows()) {
                return /^[a-z]:/i.test(path);
            } else {
                return /^\//.test(path);
            }
        },

        
        openNode: function(name) {
            var node = imns.Cc['@mozilla.org/file/local;1'];
            node = node.createInstance(imns.Ci.nsILocalFile);
            node.initWithPath(name);
            return node;
        },

        
        openMacroFile: function(macro) {
            
            var file = imns.Pref.getFilePref("defsavepath");
            var nodes = macro.split(this.psep);
            while (nodes.length)
                file.append(nodes.shift());

            return file;
        },
        
        
        makeDirectory: function(name) {
            var dir = this.openNode(name);
            if ( dir.exists() ) {
                if ( !dir.isDirectory() ) {
                    dir.remove(false);
                    dir.create(imns.Ci.nsIFile.DIRECTORY_TYPE, 0777);
                }
            } else {
                dir.create(imns.Ci.nsIFile.DIRECTORY_TYPE, 0777);
            }
            return dir;
        },
        
        
        copyFiles: function (src, dst) {
            try {
                if (src == dst) {
                    Components.utils.
                    reportError("copyFiles error: src equals dst!");
                    return false;
                }
                var src_dir = this.openNode(src);
                if (!src_dir.exists()) {
                    Components.utils.
                    reportError("copyFiles error: src "+src_dir.path+
                                " doesn't exists!");
                    return false;
                }
                
                var dst_dir = this.makeDirectory(dst);

                
                var entries = src_dir.directoryEntries;
                while (entries.hasMoreElements()) {
                    var tmp = null;
                    var entry = entries.getNext().
                    QueryInterface(imns.Ci.nsILocalFile);
                    if (entry.isDirectory()) {
                        tmp = dst_dir.clone();
                        tmp.append(entry.leafName);
                        this.copyFiles(entry.path, tmp.path);
                    } else {
                        tmp = this.openNode(dst_dir.path);
                        tmp.append(entry.leafName);
                        if (tmp.exists())
                            tmp.remove(false);
                        entry.copyTo(dst_dir, null);
                    }
                }
            } catch (e) {
                Components.utils.reportError(e);
                return false;
            }
            
            return true;
        },

        _uconv: function() {
            var uniconv = imns.Cc["@mozilla.org/intl/scriptableunicodeconverter"]
            .createInstance(imns.Ci.nsIScriptableUnicodeConverter);
            return uniconv;
        },

        _ios: function() {
            var ios = imns.Cc["@mozilla.org/network/io-service;1"]
            .getService(imns.Ci.nsIIOService);
            return ios;
        },

        _fos: function() {
            var fos = imns.Cc["@mozilla.org/network/file-output-stream;1"]
            .createInstance(imns.Ci.nsIFileOutputStream);
            return fos;
        },

        _fis: function() {
            var fis = imns.Cc["@mozilla.org/network/file-input-stream;1"]
            .createInstance(imns.Ci.nsIFileInputStream);
            return fis;
        },

        
        convertToUTF8: function (str) {
            var uniconv = this._uconv();
            uniconv.charset = 'UTF-8';
            return uniconv.ConvertFromUnicode(str);
        },

        
        convertFromUTF8: function(str) {
            var uniconv = this._uconv();
            uniconv.charset = 'UTF-8';
            return uniconv.ConvertToUnicode(str);
        },

        
        _write: function( file,
             str) {
            var fos = this._fos();
            fos.init(file, 0x02|0x08|0x20, 0664, 0);
            fos.write(str, str.length);
            fos.close();
        },

        
        _append: function( file,
             str) {
            var fos = imns.Cc["@mozilla.org/network/file-output-stream;1"]
            .createInstance(imns.Ci.nsIFileOutputStream);
            fos.init(file, 0x02|0x08|0x10, 0664, 0);
            fos.write(str, str.length);
            fos.close();
        },

        
        
        detectBOM: function( file) {
            var ios = this._ios();
            var bstream = imns.Cc["@mozilla.org/binaryinputstream;1"]
            .getService(imns.Ci.nsIBinaryInputStream);
            var channel = ios.newChannelFromURI(ios.newFileURI(file));
            var input = channel.open();
            bstream.setInputStream(input);

            var charset = "unknown";
            if (input.available() > 4) {
                var data = bstream.readBytes(4);
                if (data.charCodeAt(0) == 239 &&
                    data.charCodeAt(1) == 187 &&
                    data.charCodeAt(2) == 191) {
                    charset = "UTF-8";
                } else if (data.charCodeAt(0) == 0 &&
                           data.charCodeAt(1) == 0 &&
                           data.charCodeAt(2) == 254 &&
                           data.charCodeAt(3) == 255) {
                    charset = "UTF-32BE";
                } else if (data.charCodeAt(0) == 255 &&
                           data.charCodeAt(1) == 254 &&
                           data.charCodeAt(2) == 0 &&
                           data.charCodeAt(3) == 0) {
                    charset = "UTF-32LE";
                } else if (data.charCodeAt(0) == 255 &&
                           data.charCodeAt(1) == 254) {
                    charset = "UTF-16LE";
                } else if (data.charCodeAt(0) == 254 &&
                           data.charCodeAt(1) == 255) {
                    charset = "UTF-16BE";
                } 
            }
            
            bstream.close();
            input.close();
            return charset;
        },

        
        _read: function( file, charset) {
            var is = imns.Cc["@mozilla.org/intl/converter-input-stream;1"]
                .createInstance(imns.Ci.nsIConverterInputStream);
            const rc = imns.Ci.nsIConverterInputStream.
                  DEFAULT_REPLACEMENT_CHARACTER;
            var fis = this._fis(), data = "", str = {};

            fis.init(file, -1, 0, 0);
            is.init(fis, charset, 1024, rc);
            while (is.readString(4096, str) != 0)
                data += str.value;
            is.close();
            return data;
        },


        
        
        
        
        _win_CP_to_charset_name: function(cp) {
            switch(cp) {
            case 37: return "IBM037";
            case 437: return "IBM437";
            case 500: return "IBM500";
            case 708: return "ASMO-708";
            case 709: return "ASMO";
            case 710: return "ASMO";
            case 720: return "DOS-720";
            case 737: return "ibm737";
            case 775: return "ibm775";
            case 850: return "ibm850";
            case 852: return "ibm852";
            case 855: return "IBM855";
            case 857: return "ibm857";
            case 858: return "IBM00858";
            case 860: return "IBM860";
            case 861: return "ibm861";
            case 862: return "DOS-862";
            case 863: return "IBM863";
            case 864: return "IBM864";
            case 865: return "IBM865";
            case 866: return "cp866";
            case 869: return "ibm869";
            case 870: return "IBM870";
            case 874: return "windows-874";
            case 875: return "cp875";
            case 932: return "shift_jis";
            case 936: return "gb2312";
            case 949: return "ks_c_5601-1987";
            case 950: return "big5";
            case 1026: return "IBM1026";
            case 1047: return "IBM01047";
            case 1140: return "IBM01140";
            case 1141: return "IBM01141";
            case 1142: return "IBM01142";
            case 1143: return "IBM01143";
            case 1144: return "IBM01144";
            case 1145: return "IBM01145";
            case 1146: return "IBM01146";
            case 1147: return "IBM01147";
            case 1148: return "IBM01148";
            case 1149: return "IBM01149";
            case 1200: return "utf-16";
            case 1201: return "unicodeFFFE";
            case 1250: return "windows-1250";
            case 1251: return "windows-1251";
            case 1252: return "windows-1252";
            case 1253: return "windows-1253";
            case 1254: return "windows-1254";
            case 1255: return "windows-1255";
            case 1256: return "windows-1256";
            case 1257: return "windows-1257";
            case 1258: return "windows-1258";
            case 1361: return "Johab";
            case 10000: return "macintosh";
            case 10001: return "x-mac-japanese";
            case 10002: return "x-mac-chinesetrad";
            case 10003: return "x-mac-korean";
            case 10004: return "x-mac-arabic";
            case 10005: return "x-mac-hebrew";
            case 10006: return "x-mac-greek";
            case 10007: return "x-mac-cyrillic";
            case 10008: return "x-mac-chinesesimp";
            case 10010: return "x-mac-romanian";
            case 10017: return "x-mac-ukrainian";
            case 10021: return "x-mac-thai";
            case 10029: return "x-mac-ce";
            case 10079: return "x-mac-icelandic";
            case 10081: return "x-mac-turkish";
            case 10082: return "x-mac-croatian";
            case 12000: return "utf-32";
            case 12001: return "utf-32BE";
            case 20000: return "x-Chinese_CNS";
            case 20001: return "x-cp20001";
            case 20002: return "x_Chinese-Eten";
            case 20003: return "x-cp20003";
            case 20004: return "x-cp20004";
            case 20005: return "x-cp20005";
            case 20105: return "x-IA5";
            case 20106: return "x-IA5-German";
            case 20107: return "x-IA5-Swedish";
            case 20108: return "x-IA5-Norwegian";
            case 20127: return "us-ascii";
            case 20261: return "x-cp20261";
            case 20269: return "x-cp20269";
            case 20273: return "IBM273";
            case 20277: return "IBM277";
            case 20278: return "IBM278";
            case 20280: return "IBM280";
            case 20284: return "IBM284";
            case 20285: return "IBM285";
            case 20290: return "IBM290";
            case 20297: return "IBM297";
            case 20420: return "IBM420";
            case 20423: return "IBM423";
            case 20424: return "IBM424";
            case 20833: return "x-EBCDIC-KoreanExtended";
            case 20838: return "IBM-Thai";
            case 20866: return "koi8-r";
            case 20871: return "IBM871";
            case 20880: return "IBM880";
            case 20905: return "IBM905";
            case 20924: return "IBM00924";
            case 20932: return "EUC-JP";
            case 20936: return "x-cp20936";
            case 20949: return "x-cp20949";
            case 21025: return "cp1025";
            case 21866: return "koi8-u";
            case 28591: return "iso-8859-1";
            case 28592: return "iso-8859-2";
            case 28593: return "iso-8859-3";
            case 28594: return "iso-8859-4";
            case 28595: return "iso-8859-5";
            case 28596: return "iso-8859-6";
            case 28597: return "iso-8859-7";
            case 28598: return "iso-8859-8";
            case 28599: return "iso-8859-9";
            case 28603: return "iso-8859-13";
            case 28605: return "iso-8859-15";
            case 29001: return "x-Europa";
            case 38598: return "iso-8859-8-i";
            case 50220: return "iso-2022-jp";
            case 50221: return "csISO2022JP";
            case 50222: return "iso-2022-jp";
            case 50225: return "iso-2022-kr";
            case 50227: return "x-cp50227";
            case 50229: return "ISO";
            case 50930: return "EBCDIC";
            case 50931: return "EBCDIC";
            case 50933: return "EBCDIC";
            case 50935: return "EBCDIC";
            case 50936: return "EBCDIC";
            case 50937: return "EBCDIC";
            case 50939: return "EBCDIC";
            case 51932: return "euc-jp";
            case 51936: return "EUC-CN";
            case 51949: return "euc-kr";
            case 51950: return "EUC";
            case 52936: return "hz-gb-2312";
            case 54936: return "GB18030";
            case 57002: return "x-iscii-de";
            case 57003: return "x-iscii-be";
            case 57004: return "x-iscii-ta";
            case 57005: return "x-iscii-te";
            case 57006: return "x-iscii-as";
            case 57007: return "x-iscii-or";
            case 57008: return "x-iscii-ka";
            case 57009: return "x-iscii-ma";
            case 57010: return "x-iscii-gu";
            case 57011: return "x-iscii-pa";
            case 65000: return "utf-7";
            case 65001: return "utf-8";
            default:
                return "unknown";
            };
        },

        
        readTextFile: function( file) {
            var charset = this.detectBOM(file), data = "";
            if (charset != "unknown")
                return this._read(file, charset);

            charset_list = [];
            if (imns.is_windows()) {
                
                
                imns.Cu.import("resource://gre/modules/ctypes.jsm", this);
                var kernel32_dll = this.ctypes.open("kernel32.dll");
                var GetACP = kernel32_dll.declare(
                    "GetACP", this.ctypes.default_abi, this.ctypes.uint32_t
                );
                var codepage = GetACP();
                kernel32_dll.close();
                charset_list = [this._win_CP_to_charset_name(codepage)];
            }

            charset_list = charset_list.concat(["UTF-8", "UTF-16", "UTF-32"]);
            for (var i = 0; i < charset_list.length; i++) {
                data = this._read(file, charset_list[i]);
                
                
                if (data.match(/\uFFFD|\0/))
                    continue;
                else
                    return data;
            }

            throw new Error("Unable to detect the file ("+
                            file.path+
                            ") charset");
        },

        
        writeTextFile: function( file,  text) {
            var utf8bom = String.fromCharCode(239)+
                String.fromCharCode(187)+
                String.fromCharCode(191);
            var data = utf8bom+this.convertToUTF8(text);
            this._write(file, data);
        },

        
        appendTextFile: function( file,  text) {
            var data = this.convertToUTF8(text);
            if (!file.exists()) {
                var utf8bom = String.fromCharCode(239)+
                    String.fromCharCode(187)+
                    String.fromCharCode(191);
                data = utf8bom + data;
            }
            this._append(file, data);
        },
    },


    
    Dialogs: {
        
        browseForFolder: function (title,  defdir) {
            try {
                var fp = imns.Cc["@mozilla.org/filepicker;1"]
                .createInstance(imns.Ci.nsIFilePicker);
                fp.init(imns.__win, title, imns.Ci.nsIFilePicker.modeGetFolder);
                if (defdir)
                    fp.displayDirectory = defdir;
                var rv = fp.show();
                if (rv == imns.Ci.nsIFilePicker.returnOK) {
                    return fp.file;
                }
            } catch(e) {
                Components.utils.reportError(e);
            }
            return null;
        },

        browseForFileSave: function (title, filename, defdir, win) {
            try {
                var fp = imns.Cc["@mozilla.org/filepicker;1"]
                  .createInstance(imns.Ci.nsIFilePicker);
                fp.init(imns.__win, title, imns.Ci.nsIFilePicker.modeSave);
                fp.defaultString = filename;
                
                if (/\.js$/.test(filename))
                    fp.appendFilter("iMacros script", "*.js");
                else if (/\.iim$/.test(filename))
                    fp.appendFilter("iMacros macro", "*.iim");
                else if (/\.(?:png|jpe?g)$/.test(filename))
                    fp.appendFilters(fp.filterImages);
                fp.appendFilters(imns.Ci.nsIFilePicker.filterAll);

                fp.filterIndex = 0;
                var rootdir = defdir ? defdir :
                    imns.Pref.getFilePref("defsavepath");
                fp.displayDirectory = rootdir;
                
                var r = fp.show();
                if(r == imns.Ci.nsIFilePicker.returnOK ||
                   r == imns.Ci.nsIFilePicker.returnReplace) {
                    return fp.file;
                }
            } catch(e) {
                Components.utils.reportError(e);
            }
            return null;
        },


        browseForFileOpen: function (title,  defdir) {
            try {
                var fp = imns.Cc["@mozilla.org/filepicker;1"]
                .createInstance(imns.Ci.nsIFilePicker);
                fp.init(imns.__win, title, imns.Ci.nsIFilePicker.modeOpen);
                
                fp.appendFilters(imns.Ci.nsIFilePicker.filterAll);
                fp.filterIndex = 0;
                var rootdir = defdir ? defdir :
                    imns.Pref.getFilePref("defsavepath");
                fp.displayDirectory = rootdir;
                
                var r = fp.show();
                if(r == imns.Ci.nsIFilePicker.returnOK ||
                   r == imns.Ci.nsIFilePicker.returnReplace) {
                    return fp.file;
                }
            } catch(e) {
                Components.utils.reportError(e);
            }
            return null;
        },

        
        confirm: function(text) {
            var prompts = imns.Cc["@mozilla.org/embedcomp/prompt-service;1"]
            .getService(imns.Ci.nsIPromptService);
            var check = {value: false};
            
            var flags = prompts.STD_YES_NO_BUTTONS;
            var button = prompts.confirmEx(imns.__win, "", text,
                flags, "", "", "", null, check);
            return button == 0;
        },

        confirmCheck: function(title, msg, check_msg, check_value) {
            var prompts = imns.Cc["@mozilla.org/embedcomp/prompt-service;1"]
                .getService(imns.Ci.nsIPromptService);
            return prompts.confirmCheck(imns.__win, title, msg,
                                        check_msg, check_value);
        }
    },



    
    Pref: {
        get psvc() {
            return Components.classes["@mozilla.org/preferences-service;1"].
	    getService(Components.interfaces.nsIPrefService);
        },

        get imBranch() {
            return this.psvc.getBranch("extensions.imacros.");

        },

        get defBranch() {
            return this.psvc.getBranch(null);
        },

        _get_branch: function(oldpref) {
            return (oldpref ? this.defBranch : this.imBranch);
        },

        getIntPref: function(prefName, oldpref) {
            try {
                return this._get_branch(oldpref).getIntPref(prefName);
            } catch(e) {
                
                return null;
            }
        },

        setIntPref: function(prefName, value, oldpref) {
            try {
                this._get_branch(oldpref).setIntPref(prefName, value);
            } catch(e) {
                Components.utils.reportError(e);
            }
        },

        getCharPref: function(prefName, oldpref) {
            try {
                return this._get_branch(oldpref).getCharPref(prefName);
            } catch(e) {
                
                return null;
            }
        },

        setCharPref: function(prefName, value, oldpref) {
            try {
                this._get_branch(oldpref).setCharPref(prefName, value);
            } catch(e) {
                Components.utils.reportError(e);
            }
        },

        getBoolPref: function(prefName, oldpref) {
            try {
                return this._get_branch(oldpref).getBoolPref(prefName);
            } catch(e) {
                
                return null;
            }
        },

        setBoolPref: function(prefName, value, oldpref) {
            try {
                this._get_branch(oldpref).setBoolPref(prefName, value);
            } catch(e) {
                Components.utils.reportError(e);
            }
        },

        getFilePref: function(prefName, oldpref) {
            try {
                var store = this.getBoolPref("store-in-profile");
                if (store && !oldpref) {
                    var ds = imns.Cc["@mozilla.org/file/directory_service;1"].
                    getService(imns.Ci.nsIProperties);
                    var profdir = ds.get("ProfD", imns.Ci.nsILocalFile);
                    profdir.append("iMacros");
                    switch(prefName) {
                    case "defdownpath":
                        profdir.append("Downloads");
                        break;
                    case "defdatapath":
                        profdir.append("Datasources");
                        break;
                    case "deflogpath":
                        break;
                    case "defsavepath":
                        profdir.append("Macros");
                        break;
                    default:
                        return this._get_branch(oldpref).getComplexValue(
                            prefName, imns.Ci.nsILocalFile
                        );
                    }
                    return profdir;
                } else {
                    if (oldpref)
                        return this._get_branch(oldpref).getCharPref(prefName);
                    else
                        return this._get_branch(oldpref).getComplexValue(
                            prefName, imns.Ci.nsILocalFile
                        );
                }
            } catch(e) {
                
                return null;
            }
        },

        setFilePref: function(prefName, value, oldpref) {
            try {
                var x = value.QueryInterface(imns.Ci.nsILocalFile);
                this._get_branch(oldpref).
                setComplexValue(prefName, imns.Ci.nsILocalFile, x);
            } catch(e) {
                Components.utils.reportError(e);
            }
        },

        getStringPref: function(prefName, oldpref) {
            try {
                return this._get_branch(oldpref).
                getComplexValue(prefName, imns.Ci.nsISupportsString).data;
            } catch(e) {
                
                return null;
            }
        },

        setStringPref: function(prefName, value, oldpref) {
            try {
                this._get_branch(oldpref).
                setComplexValue(prefName, imns.Ci.nsISupportsString, value);
            } catch(e) {
                Components.utils.reportError(e);
            }
        },

        clearPref: function(prefName, oldpref) {
            try {
                this._get_branch(oldpref).clearUserPref(prefName);
            } catch (e) {
                
            }
        }
        
    },



    Clipboard: {
        
        get clip() {
            return imns.Cc["@mozilla.org/widget/clipboard;1"].
            getService(imns.Ci.nsIClipboard);
        },
        
        putString: function(txt) {
            var str = imns.Cc["@mozilla.org/supports-string;1"].
            createInstance(imns.Ci.nsISupportsString);
            str.data = txt;
            var trans = imns.Cc["@mozilla.org/widget/transferable;1"].
            createInstance(imns.Ci.nsITransferable);
            trans.addDataFlavor("text/unicode");
            trans.setTransferData("text/unicode", str, txt.length * 2);
            this.clip.setData(trans, null, imns.Ci.nsIClipboard.kGlobalClipboard)
        },

        getString: function() {
            var has_data = this.clip.hasDataMatchingFlavors(["text/unicode"], 1,
                imns.Ci.nsIClipboard.kGlobalClipboard);
            if (!has_data)
                return null;
            var trans = imns.Cc["@mozilla.org/widget/transferable;1"].
            createInstance(imns.Ci.nsITransferable);
            trans.addDataFlavor("text/unicode");
            this.clip.getData(trans, imns.Ci.nsIClipboard.kGlobalClipboard);
            var str = {}, len = {};
            trans.getTransferData("text/unicode", str, len);
            str = str.value.QueryInterface(imns.Ci.nsISupportsString);  
            var txt = str.data.substring(0, len.value/2);  
            return txt;
        }
    },

    
    msg2con: function(code, errtext, extract, performance) {
        var s;
        if (code > 0)
            errtext = "Macro compeleted OK.";
        if (!extract) extract = "";
        if (!performance) performance = "";
        s = errtext+"[iim!E!iim]"+extract+"[iim!S!iim]"+performance;

        return s;
    },


    
    
    __getstr: function(wnd, id) {
        var s = wnd.document.getElementById(id);
        return s ? s.value : "";
    },


    
    
    
    s2i: function (num) {
        var s = num.toString();
        s = s.replace(/^\s+/, "").replace(/\s+$/, "");
        if (!s.length)
            return Number.NaN;
        var n = parseInt(s);
        if (n.toString().length != s.length)
            return Number.NaN;
        return n;
    },
    
    str: {
        trim: function(s) {
            return s.replace(/^\s+/, "").replace(/\s+$/, "");
        }
    },


    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    

    unwrap: function(line) {
        const line_re = new RegExp("^\"((?:\n|.)*)\"$");
        var m = null;
        
        var handleSequence = function(s) {
            if (s == "\\\\") {
                return "\u005C";
            } else if (s == "\\0") {
                return "\u0000";
            } else if (s == "\\b") {
                return "\u0008";
            } else if (s == "\\t") {
                return "\u0009";
            } else if (s == "\\n") {
                return "\u000A";
            } else if (s == "\\v") {
                return "\u000B";
            } else if (s == "\\f") {
                return "\u000C";
            } else if (s == "\\r") {
                return "\u000D";
            } else if (s == "\\\"") {
                return "\u0022";
            } else if (s == "\\\'") {
                return "\u0027"
            } else {
                
                var replaceChar = function (match_str, char_code) {
                    return String.fromCharCode(parseInt("0x"+char_code));
                };
                if (/^\\x/.test(s))
                    return s.replace(/\\x([\da-fA-F]{2})/g, replaceChar);
                else if (/^\\u/.test(s)) 
                    return s.replace(/\\u([\da-fA-F]{4})/g, replaceChar);
            }
        };

        var esc_re = new RegExp("\\\\(?:[0btnvfr\"\'\\\\]|x[\da-fA-F]{2}|u[\da-fA-F]{4})", "g");
        
        if (m = line.match(line_re)) {
            line = m[1];        
            
            line = line.replace(esc_re, handleSequence);
        } else {
            line = line.replace(/<br>/gi, '\n');
            line = line.replace(/<lf>/gi, '\r');
            line = line.replace(/<sp>/gi, ' ');
        }

        return line;
    },


    
    escapeLine: function(line) {
        var values_to_escape = {
                "\\u005C": "\\\\",
                "\\u0000": "\\0",
                "\\u0008": "\\b",
                "\\u0009": "\\t",
                "\\u000A": "\\n",
                "\\u000B": "\\v",
                "\\u000C": "\\f",
                "\\u000D": "\\r",
                "\\u0022": "\\\"",
                "\\u0027": "\\'"};
        
        for (var x in values_to_escape) {
            line = line.replace(new RegExp(x, "g"), values_to_escape[x]);
        }

        return line;
    },

    
    wrap: function (line) {
        const line_re = new RegExp("^\"((?:\n|.)*)\"$");

        var m = null;
        if (m = line.match(line_re)) { 
            line = this.escapeLine(m[1]);
            
            
            line = "\""+line+"\"";
        } else {
            line = line.replace(/\t/g, "<SP>");
            line = line.replace(/\n/g, "<BR>");
            line = line.replace(/\r/g, "<LF>");
            line = line.replace(/\s/g, "<SP>");
        }

        return line;
    },


    escapeTextContent: function(str) {
        
        
        str = this.str.trim(str);
        
        str = str.replace(/[\r\n]+/g, "");
        
        str = str.replace(/\s+/g, " ");

        return str;
    },

    
    formatDate: function(str, date) {
        var prepend = function(str, num) {
            str = str.toString(); 
            var x = imns.s2i(str), y = imns.s2i(num);
            if (isNaN(x) || isNaN(y))
                return;
            while (str.length < num)
                str = '0'+str;
            return str;
        };
        var now = date ? date : new Date();
        str = str.replace(/yyyy/g, prepend(now.getFullYear(), 4));
        str = str.replace(/yy/g, now.getFullYear().toString().substr(-2));
        str = str.replace(/mm/g, prepend(now.getMonth()+1, 2));
        str = str.replace(/dd/g, prepend(now.getDate(), 2));
        str = str.replace(/hh/g, prepend(now.getHours(), 2));
        str = str.replace(/nn/g, prepend(now.getMinutes(), 2));
        str = str.replace(/ss/g, prepend(now.getSeconds(), 2));

        return str;
    }


};
