"use strict";


var fileSystem = require("../fileSystem/fileSystem");
var logger = require("../logging/logger");


class CommandHandler {

    /**
     * Handle a command request.
     * @param {FtpServer} server The FtpServer instance that received the request.
     * @param {object} clientSocket Client socket data.
     * @param {object} command The command information.
     * @returns {Promise|object} result - An object with information about how the request was handled.
     * @returns {string} result.error - Contains a description of the error that happened. 
     */
    handleRequest(server, clientSocket, command) {
        return Promise.resolve()
            .then(() => {
                if (!command.valid) {
                    logger.info(`CommandHandler.handleRequest - "${command.command}" is not valid.`);
                    return `501 "${command.command}" is not valid.\r\n`;
                }

                var handlerName = command.command.toLowerCase();
                if (!_supportedCommands.hasOwnProperty(handlerName)) {
                    logger.warning(`CommandHandler.handleRequest - "${command.command}" is not implemented.`);
                    // Send not implemented error response to client.
                    return Promise.resolve("502 Command not implemented.\r\n");
                }

                // Process the client's request using the function that has the same name as the command.
                return Promise.resolve(_supportedCommands[handlerName](server, clientSocket, command));
            })
            .then(message => {
                clientSocket.lastCommand = command.command;
                logger.info(`CommandHandler.receiveHandler - response: [${message.trim()}]`);
                return server.send(clientSocket.socketId, message);
            })
            .catch(error => {
                logger.warning(`CommandHandler.handleRequest - "${command.command}" error: ${error.message || JSON.stringify(error)}`);
                const message = "451 Server error.\r\n";
                return server.send(clientSocket.socketId, message);
            });
    }

}


var _supportedCommands = {

    cwd(server, clientSocket, command) {
        var promise = [Promise.resolve(server.getRootDirectoryEntry())];
        if (clientSocket.currentDirectoryEntryId) {
            promise.push(Promise.resolve(fileSystem.getFileSystemEntry(clientSocket.currentDirectoryEntryId)));
        }

        var rootEntry;
        return Promise.all(promise)
            .then(results => {
                rootEntry = results[0];
                let currentEntry = results[1];
                return Promise.resolve(fileSystem.getFileSystemEntryForPath(rootEntry, currentEntry || rootEntry, command.argument));
            })
            .then(changedEntry => {
                if (!changedEntry) {
                    return "400 \r\n";
                }

                clientSocket.currentDirectoryEntryId = chrome.fileSystem.retainEntry(changedEntry);

                var path = changedEntry.fullPath.substring(rootEntry.fullPath.length);
                if (path.length < 1) {
                    path = "/";
                }

                path = escapePath(path);

                var response = `250 directory changed to ${path}\r\n`;
                return response;
            })
            .catch(err => {
                let response = err.errorCode || 400;
                response = err.error ? response + " " + err.error : response + " Unknown error";
                response += "\r\n";
                return response;
            });
    },

    // feat(server, state, command, sendHandler){
    //     let response = "211-\r\n MLSD\r\n211 \r\n";
    //     return Promise.resolve(sendHandler(response));
    // },

    list(server, clientSocket) {

        // TODO: has the data connection expired? If so send an error response.

        const mark = `150 Opening ${clientSocket.binaryDataTransfer ? "BINARY" : "ASCII"} mode data connection for /bin/ls.\r\n`;
        server.send(clientSocket.socketId, mark);

        let message = null;
        return Promise.resolve(fileSystem.getFileSystemEntry(clientSocket.currentDirectoryEntryId))
            .then(currentDirectory => {
                // Get a list of files and directories.
                return Promise.resolve(fileSystem.getDirectoryEntries(currentDirectory));
            })
            .then(entries => {
                // TODO: make a file system metadata request to get information about each entry such as the size etc.
                let promises = entries.map(entry => {
                    return Promise.resolve(fileSystem.getMetadata(entry))
                        .then(metaData => {
                            return { entry, metaData };
                        });
                });

                return Promise.all(promises);
            })
            .then(entryData => {
                let fileSize = 4;
                entryData.forEach(entryDatum => {
                    fileSize = fileSize < entryDatum.metaData.size ? entryDatum.metaData.size : fileSize;
                });

                const fileSizeLength = ("" + fileSize).length;

                // If the command has an argument "-a" ignore it (always return all the entries).
                // Convert to "EPLF" (hopefully all clients accept it?)
                const lsEntries = entryData.map(entryDatum => {
                    const entry = entryDatum.entry;
                    const month = "Jan";
                    const day = createField(1, 2, false); // 2 chars
                    const hour = "01";
                    const minute = "01";
                    if (entry.isDirectory) {
                        //return `+/,\t${entry.name}\r\n`;
                        return `dr-xr-xr-x 1 0 0 ${createField(4096, fileSizeLength, false)} ${month} ${day} ${hour}:${minute} ${entry.name}`;
                    } else if (entry.isFile) {
                        //return `+r,\t${entry.name}\r\n`;
                        return `-rw-r--r-- 1 0 0 ${createField(entryDatum.metaData.size, fileSizeLength, false)} ${month} ${day} ${hour}:${minute} ${entry.name}`;
                    }
                });

                // Join the strings.
                message = lsEntries.join("\r\n") + "\r\n";

                // Get the connection to send the response.
                return clientSocket.passiveServer.send(clientSocket.passiveServer.clientSocketId, message, clientSocket.binaryDataTransfer);
            })
            .then(() => {
                logger.verbose(`CommandHandler.list() - connection send is finished.`);
                return Promise.resolve(clientSocket.passiveServer.close());
            })
            .then(() => {
                logger.verbose("CommandHandler.list() - passive server is closed.");
                clientSocket.passiveServer = null;
                return "226 Transfer complete\r\n";
            })
            .catch(err => {
                logger.error(err);
                if (clientSocket && clientSocket.passiveServer) {
                    clientSocket.passiveServer = null;
                }
                return "451 Server LIST error.\r\n";
            });
    },

    // mlsd(server, state, command, sendHandler){

    // },

    pass(server, clientSocket, command) {
        var loginMessage = server.loginMessage;
        var response = "230 User logged in, proceed.\r\n";
        if (loginMessage) {
            loginMessage = Array.isArray(loginMessage) ? loginMessage : [loginMessage];
            response = "230-User logged in, proceed.\r\n";
            for (var i = 0; i < loginMessage.length; i++) {
                response += ("    " + loginMessage[i] + "\r\n");
            }
            response += "230 \r\n";
        }

        if (clientSocket.lastCommand !== "USER") {
            // It's an error if USER is not the previous command received.
            response = "503 USER required first.\r\n";
        }
        else {
            if (!server.allowAnonymousLogin) {
                if (clientSocket.username !== server.username || command.argument !== server.password) {
                    clientSocket.username = null;
                    response = "530 Username and/or password is incorrect.\r\n";
                } else {
                    clientSocket.anonymous = false;
                    clientSocket.loggedIn = true;
                }
            } else {
                clientSocket.anonymous = true;
                clientSocket.username = command.argument;
                clientSocket.loggedIn = true;
            }
        }

        return response;
    },

    /**
     * Server should enter passive mode.
     */
    pasv(server, clientSocket) {
        // TODO: if the client has already made a PASV request close the
        // existing port (stop any data flow first) and discard it. 

        // The server must open a port for data connections from the client and
        // listen on this port - for a while. TBD how long to keep the port
        // active.
        return Promise.resolve(server.createPassiveServer(clientSocket))
            .then(() => {
                const fd = clientSocket.passiveServer;
                // RFC 959 response.
                const h = fd.address.replace(/\./g, ",");

                // Divide the port value by 256 and discard any fractional
                // part, this is p1. Subtract p1 * 256 from the port value,
                // this is p2.
                const p1 = Math.trunc(fd.port / 256);
                const p2 = fd.port - (p1 * 256);

                let response = `227 Entering Passive Mode. (${h},${p1},${p2})\r\n`;
                return response;
            });
    },

    /**
     * Return an absolute path. The root is the server's current root directory.
     */
    pwd(server, clientSocket, command) {
        var promises = [server.getRootDirectoryEntry()];
        if (clientSocket.currentDirectoryEntryId) {
            promises.push(fileSystem.getFileSystemEntry(clientSocket.currentDirectoryEntryId));
        }

        var rootEntry = null;
        var currentEntry = null;
        return Promise.all(promises)
            .then(function(results) {
                rootEntry = results[0];
                currentEntry = results[1] || results[0];

                var path = currentEntry.fullPath.substring(rootEntry.fullPath.length);
                if (path.length < 1) {
                    path = "/";
                }

                path = escapePath(path);

                // The path is surrounded by double quotes.
                var response = `257 "${path}"\r\n`;
                return response;
            });
    },

    retr(server, clientSocket, command) {
        const mark = `150 Opening ${clientSocket.binaryDataTransfer ? "BINARY" : "ASCII"} mode data connection for /bin/ls.\r\n`;
        server.send(clientSocket.socketId, mark);

        let promise = [Promise.resolve(server.getRootDirectoryEntry())];
        if (clientSocket.currentDirectoryEntryId) {
            promise.push(Promise.resolve(fileSystem.getFileSystemEntry(clientSocket.currentDirectoryEntryId)));
        }

        let rootEntry;
        return Promise.all(promise)
            .then(results => {
                rootEntry = results[0];
                let currentEntry = results[1];
                return Promise.resolve(fileSystem.getFileSystemEntryForPath(rootEntry, currentEntry || rootEntry, command.argument));
            })
            .then(entry => {
                return fileSystem.getFile(entry);
            }).then(file => {
                logger.verbose(`CommandHandler.retr() - file size ${file.size}.`);
                let start = 0;
                return clientSocket.passiveServer.sendStream(clientSocket.passiveServer.clientSocketId, () => {
                    if (file.size <= start) {
                        return null;
                    }

                    let end = start + server.streamBufferSize;
                    end = end < file.size ? end : file.size;
                    logger.verbose(`CommandHandler.retr() - next transfer total bytes ${end}.`);

                    let currentStart = start;
                    start += server.streamBufferSize;

                    let blob = file.slice(currentStart, end);
                    return blobToArrayBuffer(blob);
                });
            })
            .then(() => {
                logger.verbose(`CommandHandler.retr() - connection send is finished.`);
                return Promise.resolve(clientSocket.passiveServer.close());
            })
            .then(() => {
                logger.verbose("CommandHandler.retr() - passive server is closed.");
                clientSocket.passiveServer = null;
                return "226 Transfer complete\r\n";
            })
            .catch(err => {
                logger.error(err);
                if (clientSocket && clientSocket.passiveServer) {
                    clientSocket.passiveServer = null;
                }
                return "451 Server RETR error.\r\n";
            });
    },

    syst() {
        // Much like the http user-agent header SYST has become pointless.
        // Return a supposedly meaningless server string.
        return "215 UNIX Type: L8\r\n";
    },

    type(server, clientSocket, command) {
        var status = "200 ";

        // All transfers are binary.

        // var fileTransferType = command.argument.toUpperCase();
        // switch (fileTransferType) {
        //     case "A":
        //         clientSocket.binaryDataTransfer = false;
        //         status = "200 ";
        //         break;

        //     case "I":
        //         clientSocket.binaryDataTransfer = true;
        //         status = "200 ";
        //         break;
        // }

        return `${status}\r\n`;
    },

    user(server, clientSocket, command) {
        let response = null;
        if (typeof clientSocket.lastCommand !== "undefined" && clientSocket.lastCommand !== null) {
            // It's an error if USER is not the first command received.
            response = "503 USER required first.\r\n";
        }

        if (clientSocket.username) {
            // It's an error if USER has already been sent.
            response = "503 already set.\r\n";
        }

        // Always allow login to proceed from user. If the username and / or password are incorrect an error is returned in pass().
        if (response === null) {
            response = `331 Anonymous login ${server.allowAnonymousLogin ? "is" : "is not"} allowed.\r\n`;
            clientSocket.user = server.allowAnonymousLogin ? server.username : command.argument;
        }

        return response;
    },

    xpwd(server, fc, command) {
        return this.pwd(server, fc, command);
    }

};


module.exports = CommandHandler;


function blobToArrayBuffer(blob) {
    return new Promise(resolve => {
        let reader = new FileReader();
        reader.onload = function() {
            resolve(this.result);
        };

        reader.readAsArrayBuffer(blob);
    });
}

/**
 * Create a text string with specific padding.
 * @param {any} value Any value that can be converted to a string.
 * @param {number} length The length of the output string in characters.
 * @param {boolean} [leftAlignValue=true] If true the value will be aligned to the left side of the string.
 * @returns {string} A string with the length requested.
 */
function createField(value, length, leftAlignValue) {
    const lav = typeof leftAlignValue !== "boolean" ? true : leftAlignValue;
    const field = Array(length).join(" ");
    if (lav) {
        return (value + field).substring(0, length);
    } else {
        return (field + value).slice(-length);
    }
}

function escapePath(path) {
    // A single double quote character '"' should be replaced with two double quotes.
    var escapedPath = path.replace("\"", "\"\"");

    // Replace "device control two" with null.
    return escapedPath.replace("\u0012", "\u0000");
}
