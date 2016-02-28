"use strict";


var fileSystem = require("../fileSystem/fileSystem");
var logger = require("../logging/logger");


class CommandHandler {

    /**
     * Handle a command request.
     * @param {FtpServer} server The FtpServer instance that received the request.
     * @param {FtpCommandConnection} fc The connection to the client.
     * @param {object} command The command information.
     * @returns {Promise|object} result - An object with information about how the request was handled.
     * @returns {string} result.error - Contains a description of the error that happened. 
     */
    handleRequest(server, fc, command) {
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
                return Promise.resolve(_supportedCommands[handlerName](server, fc, command));
            })
            .then(message => {
                fc.lastCommand = command.command;
                logger.info(`CommandHandler.receiveHandler - response: [${message.trim()}]`);
                return fc.send(message);
            })
            .catch(error => {
                logger.warning(`CommandHandler.handleRequest - "${command.command}" error: ${error.message || JSON.stringify(error)}`);
                const message = "451 Server error.\r\n";
                return fc.send(message);
            });
    }

}


var _supportedCommands = {

    cwd(server, fc, command) {
        // Is the requested directory acessible?
        var promise = [Promise.resolve(server.getRootDirectoryEntry())];
        if (fc.currentDirectoryEntryId) {
            promise.push(Promise.resolve(fileSystem.getFileSystemEntry(fc.currentDirectoryEntryId)));
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

                fc.currentDirectoryEntryId = chrome.fileSystem.retainEntry(changedEntry);

                var path = changedEntry.fullPath.substring(rootEntry.fullPath.length);
                if (path.length < 1) {
                    path = "/";
                }

                path = escapePath(path);

                var response = `250 directory changed to ${path}\r\n`;
                return response;
            })
            .catch(err => {
                var response = "400 ";
                if (typeof err === "object" && err.code) {
                    response = err.code;
                }

                response += "\r\n";
                return response;
            });
    },

    // feat(server, state, command, sendHandler){
    //     let response = "211-\r\n MLSD\r\n211 \r\n";
    //     return Promise.resolve(sendHandler(response));
    // },

    list(server, fc, command) {

        // TODO: has the data connection expired? If so send an error response.

        const mark = `150 Opening ${fc.binaryDataTransfer ? "BINARY" : "ASCII"} mode data connection for /bin/ls.\r\n`;
        fc.send(mark);

        // Invoke the DataConnection list function. The function has a fourth
        // parameter for a callback. This callback is invoked after the client
        // has connected to this server. The callback returns a promise that
        // the DataConnection waits to resolve before it sends the data over
        // the connection.
        let response = null;
        return Promise.resolve(fc.dataConnection.list(server, fc, command))
            .then(message => {
                logger.verbose(`CommandHandler.list() - DataConnection.list() is finished.`);
                response = message;
                return Promise.resolve(fc.dataConnection.close());
            })
            .then(() => {
                logger.verbose("CommandHandler.list() - data connection closed.");
                fc.dataConnection = null;
                return response;
            })
            .catch(err => {
                logger.error(err);
                if (fc && fc.dataConnection) {
                    fc.dataConnection = null;
                }
                return "451 Server LIST error.\r\n";
            });
    },

    // mlsd(server, state, command, sendHandler){

    // },

    pass(server, fc, command) {
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

        if (fc.lastCommand !== "USER") {
            // It's an error if USER is not the previous command received.
            response = "503 USER required first.\r\n";
        }
        else {
            if (!server.allowAnonymousLogin) {
                if (fc.username !== server.username || command.argument !== server.password) {
                    fc.username = null;
                    response = "530 Username and/or password is incorrect.\r\n";
                } else {
                    fc.anonymous = false;
                    fc.loggedIn = true;
                }
            } else {
                fc.anonymous = true;
                fc.username = command.argument;
                fc.loggedIn = true;
            }
        }

        return response;
    },

    /**
     * Server should enter passive mode.
     */
    pasv(server, fc) {
        // TODO: if the client has already made a PASV request close the
        // existing port (stop any data flow first) and discard it. 

        // The server must open a port for data connections from the client and
        // listen on this port - for a while. TBD how long to keep the port
        // active.
        return Promise.resolve(server.createPassiveDataConnection(fc))
            .then(() => {
                const fd = fc.dataConnection;
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
    pwd(server, fc, command) {
        var promises = [server.getRootDirectoryEntry()];
        if (fc.currentDirectoryEntryId) {
            promises.push(fileSystem.getFileSystemEntry(fc.currentDirectoryEntryId));
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

    syst() {
        // Much like the http user-agent header SYST has become pointless.
        // Return a supposedly meaningless server string.
        return "215 UNIX Type: L8\r\n";
    },

    type(server, fc, command) {
        var status = "502 ";
        var fileTransferType = command.argument.toUpperCase();
        switch (fileTransferType) {
            case "A":
                fc.binaryDataTransfer = false;
                status = "200 ";
                break;

            case "I":
                fc.binaryDataTransfer = true;
                status = "200 ";
                break;
        }

        return `${status}\r\n`;
    },

    user(server, fc, command) {
        let response = null;
        if (typeof fc.lastCommand !== "undefined" && fc.lastCommand !== null) {
            // It's an error if USER is not the first command received.
            response = "503 USER required first.\r\n";
        }

        if (fc.username !== null) {
            // It's an error if USER has already been sent.
            response = "503 already set.\r\n";
        }

        // Always allow login to proceed from user. If the username and / or password are incorrect an error is returned in pass().
        if (response === null) {
            response = `331 Anonymous login ${server.allowAnonymousLogin ? "is" : "is not"} allowed.\r\n`;
            fc.user = server.allowAnonymousLogin ? server.username : command.argument;
        }

        return response;
    },

    xpwd(server, fc, command) {
        return this.pwd(server, fc, command);
    }

};


module.exports = CommandHandler;


// function createCommandRequest(request) {
//     var commandSeparatorIndex = request.indexOf(" ");
//     commandSeparatorIndex = 0 <= commandSeparatorIndex ? commandSeparatorIndex : request.indexOf("\r\n"); // Check for command with no arguments.
//     var valid = 0 < commandSeparatorIndex;
//     var result = {
//         request,
//         valid
//     };

//     if (valid) {
//         result.argument = request.substring(commandSeparatorIndex + 1, request.length - 2); // Don't include the \r\n
//         result.command = request.substring(0, commandSeparatorIndex).toUpperCase();
//     }

//     return result;
// }

function escapePath(path) {
    // A single double quote character '"' should be replaced with two double quotes.
    var escapedPath = path.replace("\"", "\"\"");

    // Replace "device control two" with null.
    return escapedPath.replace("\u0012", "\u0000");
}
