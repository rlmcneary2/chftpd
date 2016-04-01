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
        if (path === "/") {
            return rootEntry;
        }

        let parentEntry = path.startsWith("/") ? rootEntry : currentEntry;
        return Promise.resolve(getDirectoryEntryForPath.call(this, rootEntry, parentEntry, path));
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


function buildFullyQualifiedPath(rootEntry, clientPath) {
    if (!clientPath || clientPath.length < 1) {
        throw "fileSystem.js getDirectoryEntryForPath - path is null, undefined, or empty.";
    }

    if (clientPath === "/") {
        return rootEntry.fullPath;
    }

    // If the path starts with root (/) then simply build a fully qualified path.
    if (clientPath.startsWith("/")) {
        return "/" + trimPathEnds(rootEntry.fullPath) + "/" + trimPathEnds(clientPath) + "/";
    }
    
    // "."
    
    // ".."
    
    // relative path

}


function getDirectoryEntryForPath(rootEntry, parentEntry, path) {
    if (!path || path.length < 1) {
        throw "fileSystem.js getDirectoryEntryForPath - path is null, undefined, or empty.";
    }

    if (path === "/") {
        return rootEntry;
    }

    // If the path starts with root (/) then simply build a fully qualified path


    let p = trimPathEnds(path);
    let e = parentEntry;
    if (p.startsWith("..")) {
        let parts = p.split("/");
        while (0 < parts.length) {
            if (parts[parts.length - 1] !== "..") {
                break;
            }

            parts.shift();
            e = e.filesystem.root;
            if (!e.filesystem.root.fullPath.startsWith(rootEntry.fullPath)) {
                throw { message: "Directory does not exist.", code: 550 };
            }
        }

        if (parts.length < 1) {
            return e;
        }

        p = parts.join("/");
    }

    let self = this;
    return this.getDirectoryEntries(e)
        .then(entries => {
            let parts = p.split("/");
            let name = parts.shift();

            let found = entries.find(e => e.isDirectory && e.name === name);
            if (!found) {
                throw `fileSystem.js getDirectoryEntryForPath - directory "${name}" does not exist. Starting path: "${path}".`;
            }


            if (parts.length < 1) {
                return found;
            }

            return Promise.resolve(getDirectoryEntryForPath.call(self, rootEntry, found, parts.join("/")));
        });
}

/**
 * Takes a directory entry and a path and returns the new entry and a modified path for the next entry.
 */
// function getDirectoryEntry(fileSystem, entry, path) {
//     if (!path || path.length < 1) {
//         throw "fileSystem.js getDirectoryEntry() - path is null, undefined, or empty.";
//     }

//     var err = null;
//     var firstSolidusIndex = path.indexOf("/");
//     var result = null;
//     if (firstSolidusIndex === 0) {
//         // Does path start with root ('/')?
//         // The entry should be the root; return it.
//         result = entry;
//     } else if (path.startsWith("..")) {
//         // Does path start with move to parent ("..")?
//         // Get the parent entry of entry and return it.
//         result = fileSystem.getParent(entry);
//     } else {
//         // Otherwise a subdirectory name.
//         // Get the characters up to, but not including, the first '/'.
//         // Get the entry subs. If none of their names match the sub name set an error.
//         // Otherwise return the sub entry.
//         result = fileSystem.getDirectoryEntries(entry)
//             .then(entries => {
//                 let name = 0 < firstSolidusIndex ? path.substring(0, firstSolidusIndex) : path;
//                 let found = entries.find(e => e.isDirectory && e.name === name);
//                 if (!found) {
//                     err = `fileSystem.js getDirectoryEntry() - directory "${name}" does not exist. Starting path: "${path}".`;
//                     return null;
//                 }

//                 return found;
//             });
//     }

//     // NO! Do this check in calling code!    
//     // Is this directory contained in the root directory? Return error if not.

//     return Promise.resolve(result)
//         .then(nextEntry => {
//             if (err) {
//                 throw err;
//             }

//             // Strip off all characters from the up to and including the first instance of '/'.
//             var nextPath = 0 < firstSolidusIndex ? path.slice(firstSolidusIndex + 1) : null;

//             // Return the entry and next path. Destructuring function return example code follows:
//             // return [nextPath, foundEntry];
//             // var np, fe; [np fe] = getDirectoryEntry(foo, bar); 
//             return [nextPath, nextEntry];
//         });
// }

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