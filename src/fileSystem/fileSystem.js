"use strict";


module.exports = {

    getDisplayPath(entry) {
        return new Promise(function(resolve) {
            if (!entry) {
                resolve(null);
                return;
            }

            chrome.fileSystem.getDisplayPath(entry, function(path) {
                resolve(path);
            });
        });
    },

    getDirectoryEntries(entry) {
        return new Promise((resolve, reject) => {
            if (!entry.isDirectory) {
                reject(`Entry ${entry.fullPath} is not a directory.`);
            }

            var reader = entry.createReader();
            Promise.resolve(readAllDirectoryEntries(reader))
                .then(entries => {
                    resolve(entries);
                });
        });
    },

    getFileSystemEntry(id) {
        return new Promise((resolve, reject) => {
            chrome.fileSystem.restoreEntry(id, function(entry) {
                var err = chrome.runtime.lastError;
                if (err) {
                    reject(err);
                    return;
                }

                resolve(entry);
            });
        });
    },

    getFileSystemEntryForPath(rootEntry, currentEntry, path) {
        // The path is the path provided by the client as an argument to the
        // CWD command. Some clients provide an absolute path and some a
        // relative path. FTP is so much fun.
        let nextPath = buildFullyQualifiedPath(rootEntry, currentEntry, path);
        let nextParts = trimPathEnds(nextPath).split("/");
        return Promise.resolve(getDirectoryEntryForPath.call(this, nextParts, 1, rootEntry));
    },

    getMetadata(entry) {
        return new Promise((resolve, reject) => {
            entry.getMetadata(metaData => {
                resolve(metaData);
            }, err => {
                reject(err);
            });
        });
    },

    getParent(entry) {
        return new Promise(resolve => {
            entry.getParent(parent => {
                resolve(parent);
            });
        });
    }

};


function buildFullyQualifiedPath(rootEntry, currentEntry, clientPath) {
    if (!clientPath || clientPath.length < 1) {
        throw { message: "Requested path is null, undefined, or empty.", errorCode: "550", error: "No such directory"};
    }

    if (clientPath === "/") {
        return rootEntry.fullPath;
    }

    // If the client sent an absolute path the base is root. For relative paths
    // the base is the current directory.
    let baseEntry = clientPath.startsWith("/") ? rootEntry : currentEntry;

    let currentParts = trimPathEnds(baseEntry.fullPath).split("/");
    let clientParts = trimPathEnds(clientPath).split("/");
    while (0 < clientParts.length) {
        let dir = clientParts.shift();

        // ".."
        // Remove the last entry from the current path.
        if (dir === "..") {
            currentParts.pop();
            continue;
        }

        // relative path
        // Everything else just add the current entry.
        currentParts.push(dir);
    }
    
    let nextPath = "/" + currentParts.join("/"); // Don't append a trailing '/'. If this is the root there will be double forward solidus ('//') which is bad.
    if (!nextPath.endsWith("/")){
        nextPath += "/";
    }

    if (!nextPath.startsWith(rootEntry.fullPath)){
        throw { message: `Requested path '${nextPath}' is outside the root path '${rootEntry.fullPath}'.`, errorCode: 550, error: "No such directory"};
    }
    
    return nextPath;
}

function getDirectoryEntryForPath(pathParts, nextIndex, pathEntry) {
    if (pathParts.length <= nextIndex){
        return pathEntry;
    }

    let self = this;
    return this.getDirectoryEntries(pathEntry)
        .then(entries => {
            let next = pathParts[nextIndex];
            let found = entries.find(e => e.isDirectory && e.name === next);
            if (!found) {
                throw `fileSystem.js getDirectoryEntryForPath - directory '${next}' does not exist.`;
            }

            if (pathParts.length - 1 <= nextIndex) {
                return found;
            }

            return Promise.resolve(getDirectoryEntryForPath.call(self, pathParts, nextIndex + 1, found));
        });
}

function readAllDirectoryEntries(reader, accumulator) {

    return new Promise(resolve => {
        reader.readEntries(function(entries) {
            resolve(entries);
        });
    })
        .then(result => {
            accumulator = accumulator || [];

            if (result && 0 < result.length) {
                return readAllDirectoryEntries(reader, accumulator.concat(result));
            }

            return accumulator;
        });

}

function trimPathEnds(path) {
    let cleanPath = path;
    if (path !== "/" && path.startsWith("/")) {
        while (cleanPath.startsWith("/")) {
            cleanPath = cleanPath.slice(1);
        }
        while (cleanPath.endsWith("/")) {
            cleanPath = cleanPath.slice(0, cleanPath.length - 1);
        }
    }

    return cleanPath;
}