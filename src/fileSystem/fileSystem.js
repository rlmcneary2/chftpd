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
            chrome.fileSystem.restoreEntry(id, function (entry) {
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
        // Is path absolute or relative?
        // absolute
        //     begin consuming the path using rootEntry
        // relative
        //     begin consuming the path using currentEntry
        var entry = path.startsWith("/") ? rootEntry : currentEntry;
        var self = this;
        return Promise.resolve(getDirectoryEntry(this, entry, path))
            .then(results => {
                let nextPath = results[0];
                let nextEntry = results[1];
                if (!nextPath) {
                    return nextEntry;
                }
                
                if (!nextPath.fullPath.startsWith (rootEntry.fullPath)){
                    throw { code: 550, message: `fileSystem.js getFileSystemEntryForPath() - the root path "${rootEntry.fullPath}" does not contain the requested path "${nextPath.fullPath}".` };
                }

                return self.getFileSystemEntryForPath(rootEntry, currentEntry, nextPath);
            });
    },

    getMetadata(entry) {
        return new Promise((resolve, reject) => {
            entry.getMetadata(metaData=> {
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


/**
 * Takes a directory entry and a path and returns the new entry and a modified path for the next entry.
 */
function getDirectoryEntry(fileSystem, entry, path) {
    if (!path || path.length < 1) {
        throw "fileSystem.js getDirectoryEntry() - path is null, undefined, or empty.";
    }

    var err = null;
    var firstSolidusIndex = path.indexOf("/");
    var result = null;
    if (firstSolidusIndex === 0) {
        // Does path start with root ('/')?
        // The entry should be the root; return it.
        result = entry;
    } else if (path.startsWith("..")) {
        // Does path start with move to parent ("..")?
        // Get the parent entry of entry and return it.
        result = fileSystem.getParent(entry);
    } else {
        // Otherwise a subdirectory name.
        // Get the characters up to, but not including, the first '/'.
        // Get the entry subs. If none of their names match the sub name set an error.
        // Otherwise return the sub entry.
        result = fileSystem.getDirectoryEntries(entry)
            .then(entries => {
                let name = 0 < firstSolidusIndex ? path.substring(0, firstSolidusIndex) : path;
                let found = entries.find(e => e.isDirectory && e.name === name);
                if (!found) {
                    err = `fileSystem.js getDirectoryEntry() - directory "${name}" does not exist. Starting path: "${path}".`;
                    return null;
                }

                return found;
            });
    }

    // NO! Do this check in calling code!    
    // Is this directory contained in the root directory? Return error if not.
    
    return Promise.resolve(result)
        .then(nextEntry => {
            if (err) {
                throw err;
            }

            // Strip off all characters from the up to and including the first instance of '/'.
            var nextPath = 0 < firstSolidusIndex ? path.slice(firstSolidusIndex + 1) : null;
    
            // Return the entry and next path. Destructuring function return example code follows:
            // return [nextPath, foundEntry];
            // var np, fe; [np fe] = getDirectoryEntry(foo, bar); 
            return [nextPath, nextEntry];
        });
}

function readAllDirectoryEntries(reader, accumulator) {

    return new Promise(resolve => {
        reader.readEntries(function (entries) {
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
