"use strict";


var EventEmitter = require("eventemitter3");


class ServerConfiguration extends EventEmitter {

    getRootEntryFullPath(entry) {
        if (entry === null) {
            return null;
        }

        return new Promise(function (resolve) {
            chrome.fileSystem.getDisplayPath(entry, function (path) {
                resolve(path);
            });
        });
    }

}


module.exports = ServerConfiguration;
