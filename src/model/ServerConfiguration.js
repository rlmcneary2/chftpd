"use strict";


var EventEmitter = require("eventemitter3");


class ServerConfiguration extends EventEmitter {

    getRootEntryFullPath() {
        return this.getRootEntry()
            .then(function (entry) {
                if (entry === null) {
                    return null;
                }

                return new Promise(function (resolve) {
                    chrome.fileSystem.getDisplayPath(entry, function (path) {
                        resolve(path);
                    });
                });
            });
    }

    getRootEntry() {
        return new Promise(function (resolve, reject) {
            if (_rootEntry !== null) {
                return _rootEntry;
            }

            return getRootEntryId()
                .then(function (id) {
                    if (!id) {
                        return null;
                    }

                    chrome.fileSystem.restoreEntry(id, function (entry) {
                        var err = chrome.runtime.lastError;
                        if (err) {
                            reject(err);
                            return;
                        }

                        _rootEntry = entry ? entry : null;
                        resolve(_rootEntry);
                    });
                });
        });
    }

    setRootEntryId(id) {
        return new Promise(function (resolve, reject) {
            if (_rootEntryId === id){
                resolve();
                return;
            }

            _rootEntryId = id ? id : null;
            _rootEntry = null;

            if (_rootEntryId === null) {
                chrome.storage.local.remove("rootEntryId", function () {
                    resolve();
                    return;
                });
            } else {
                chrome.storage.local.set({ rootEntryId: id }, function () {
                    var err = chrome.runtime.lastError;
                    if (err) {
                        reject(err);
                        return;
                    }

                    resolve();
                });
            }
        });
    }

}


module.exports = ServerConfiguration;


var _rootEntryId = null;
var _rootEntry = null;


function getRootEntryId() {
    return new Promise(function (resolve, reject) {
        if (_rootEntryId !== null) {
            resolve(_rootEntryId);
            return;
        }

        chrome.storage.local.get("rootEntryId", function (items) {
            var err = chrome.runtime.lastError;
            if (err) {
                reject(err);
                return;
            }

            if (!items || !items.rootEntryId) {
                resolve(null);
            }

            resolve(items.rootEntryId);
        });
    });
}
