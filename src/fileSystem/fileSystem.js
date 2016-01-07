"use strict";


module.exports = {

    getDisplayPath(entry) {
        return new Promise(function (resolve) {
            if (!entry) {
                resolve(null);
                return;
            }

            chrome.fileSystem.getDisplayPath(entry, function (path) {
                resolve(path);
            });
        });
    },

    getFileSystemEntry(id) {
        return new Promise((resolve, reject) => {
            chrome.fileSystem.restoreEntry(id, function (entry) {
                var err = chrome.runtime.lastError;
                if (err) {
                    reject(err);
                    return;
                }

                resolve(entry);
            });
        });
    }

};

