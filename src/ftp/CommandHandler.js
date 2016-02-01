"use strict";


var fileSystem = require("../fileSystem/fileSystem");
var logger = require("../logging/logger");


class CommandHandler {

    /**
     * Handle a command request.
     * @param {FtpServer} server The FtpServer instance that received the request.
     * @param {object} state An object where state information can be stored for requests from this client and session.
     * @param {string} request The raw request string.
     * @param {function} sendHandler A callback that can be used to send a response to this request. The callback takes one argument which is a fully formatted FTP response string including terminating characters "\r\n". The callback returns a Promise that resolves when the message has been sent.
     * @returns {Promise|object} result - An object with information about how the request was handled.
     * @returns {string} result.error - Contains a description of the error that happened. 
     */
    handleRequest(server, state, request, sendHandler) {
        var command = createCommandRequest(request);
        return Promise.resolve()
            .then(() => {
                if (!command.valid) {
                    logger.info(`CommandHandler.js handleRequest() - "${command.command}" is not valid.`);
            
                    // TODO send error response to client.

                    return {
                        command,
                        error: `"${command.command}" is not valid.`
                    };
                }

                var handlerName = command.command.toLowerCase();
                if (!_supportedCommands.hasOwnProperty(handlerName)) {
                    logger.warning(`CommandHandler.js handleRequest() - "${command.command}" is not implemented.`);

                    // Send not implemented error response to client.
                    return Promise.resolve(sendHandler("502 Command not implemented.\r\n"))
                        .then(() => { return `"${command.command}" is not implemented.`; });
                }

                // Process the client's request using the function that has the same name as the command.
                return Promise.resolve(_supportedCommands[handlerName](server, state, command, sendHandler));
            })
            .then(error => {
                var result = {
                    command
                };

                if (typeof error !== "undefined" && error !== null) {
                    result.error = error;
                } else {
                    state.lastCommand = command.command;
                }

                return result;
            });
    }

}


var _supportedCommands = {

    cwd(server, state, command, sendHandler) {
        // Is the requested directory acessible?
        var promise = [Promise.resolve(server.getRootDirectoryEntry())];
        if (state.currentDirectoryEntryId) {
            promise.push(Promise.resolve(fileSystem.getFileSystemEntry(state.currentDirectoryEntryId)));
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
                    return Promise.resolve(sendHandler("400 \r\n"));
                }

                state.currentDirectoryEntryId = chrome.fileSystem.retainEntry(changedEntry);

                var path = changedEntry.fullPath.substring(rootEntry.fullPath.length);
                if (path.length < 1) {
                    path = "/";
                }

                path = escapePath(path);

                var response = `250 directory changed to ${path}\r\n`;
                return Promise.resolve(sendHandler(response));
            })
            .then(() => {
                return;
            })
            .catch(err => {
                var response = "400 ";
                if (typeof err === "object" && err.code){
                    response = err.code;
                }

                response += "\r\n";
                return Promise.resolve(sendHandler(response));
            });
    },
    
    // feat(server, state, command, sendHandler){
    //     let response = "211-\r\n MLSD\r\n211 \r\n";
    //     return Promise.resolve(sendHandler(response));
    // },
    
    list(server, state, command, sendHandler) {
        let response = `150 Opening ${state.binaryFileTransfer ? "BINARY" : "ASCII"} mode connection\r\n`;
        
        // TODO: has the data connection expired? If so send an error response.
        
        return Promise.resolve(sendHandler(response))
            .then(() => {
                return state.dataConnection.list(server, state, command);
            })
            .then(result => {
                // Close the data connection.
                return state.dataConnection.close()
                    .then(() => {
                        logger.verbose("CommandHandler.js list() - data connection closed.");
                        state.dataConnection = null;
                        delete state.dataConnection;

                        // Send the response provided by the result.
                        return Promise.resolve(sendHandler(result));
                    });
            })
            .catch(err => {
                logger.error(err);
            });
    },
    
    // mlsd(server, state, command, sendHandler){
        
    // },

    pass(server, state, command, sendHandler) {
        var loginMessage = server.getLoginMessage();
        var response = "230 User logged in, proceed.\r\n";
        if (loginMessage) {
            loginMessage = Array.isArray(loginMessage) ? loginMessage : [loginMessage];
            response = "230-User logged in, proceed.\r\n";
            for (var i = 0; i < loginMessage.length; i++) {
                response += ("    " + loginMessage[i] + "\r\n");
            }
            response += "230 \r\n";
        }

        if (state.lastCommand !== "USER") {
            // It's an error if USER is not the previous command received.
            response = "503 USER required first.\r\n";
        }
        else {
            if (!server.getAllowAnonymousLogin()) {
                if (state.user !== server.getUsername() || command.argument !== server.getPassword()) {
                    delete state.user;
                    response = "530 Username and/or password is incorrect.\r\n";
                } else {
                    state.loggedIn = true;
                }
            } else {
                state.anonymous = command.argument;
                state.loggedIn = true;
            }
        }

        return Promise.resolve(sendHandler(response));
    },
    
    /**
     * Server should enter passive mode.
     */
    pasv(server, state, command, sendHandler) {
        // TODO: if the client has already made a PASV request close the
        // existing port (stop any data flow first) and discard it. 

        // The server must open a port for data connections from the client and
        // listen on this port - for a while. TBD how long to keep the port
        // active.
        return Promise.resolve(server.createPassiveDataConnection(state))
            .then(result => {
                console.log(`CommandHandler.js pasv() - result: "${JSON.stringify(result) }`);
                // RFC 959 response.
                const h = result.address.replace(/\./g, ",");
                
                // Divide the port value by 256 and discard any fractional
                // part, this is p1. Subtract p1 * 256 from the port value,
                // this is p2.
                const p1 = Math.trunc(result.port / 256);
                const p2 = result.port - (p1 * 256);

                var response = `227 Entering Passive Mode. ${h},${p1},${p2}\r\n`;
                return Promise.resolve(sendHandler(response));
            });
    },

    /**
     * Return an absolute path. The root is the server's current root directory.
     */
    pwd(server, state, command, sendHandler) {
        var promises = [server.getRootDirectoryEntry()];
        if (state.currentDirectoryEntryId) {
            promises.push(fileSystem.getFileSystemEntry(state.currentDirectoryEntryId));
        }

        var rootEntry = null;
        var currentEntry = null;
        return Promise.all(promises)
            .then(function (results) {
                rootEntry = results[0];
                currentEntry = results[1] || results[0];

                var path = currentEntry.fullPath.substring(rootEntry.fullPath.length);
                if (path.length < 1){
                    path = "/";
                }
                
                path = escapePath(path);

                // The path is surrounded by double quotes.
                var response = `257 "${path}"\r\n`;

                return Promise.resolve(sendHandler(response));
            });
    },
    
    syst(server, state, command, sendHandler) {
        // Much like the http user-agent header SYST has become pointless.
        // Return a supposedly meaningless server string.
        return Promise.resolve(sendHandler("215 UNIX Type: L8\r\n"));
    },
    
    type(server, state, command, sendHandler) {
        var status = "502 ";
        var fileTransferType = command.argument.toUpperCase();
        switch (fileTransferType) {
            case "A":
                state.binaryFileTransfer = false;
                status = "200 ";
                break;

            case "I":
                state.binaryFileTransfer = true;
                status = "200 ";
                break;
        }

        return Promise.resolve(sendHandler(`${status}\r\n`));
    },

    user(server, state, command, sendHandler) {
        var response = null;
        if (typeof state.lastCommand !== "undefined" && state.lastCommand !== null) {
            // It's an error if USER is not the first command received.
            response = "503 USER required first.\r\n";
        }

        if (typeof state.user !== "undefined") {
            // It's an error if USER has already been sent.
            response = "503 already set.\r\n";
        }

        // Always allow login to proceed from user. If the username and / or password are incorrect an error is returned in pass().
        if (response === null) {
            var allowAnonymous = server.getAllowAnonymousLogin();
            response = `331 Anonymous login ${allowAnonymous ? "is" : "is not"} allowed.\r\n`;
            state.user = allowAnonymous ? server.getUsername() : command.argument;
        }

        return Promise.resolve(sendHandler(response))
            .then(() => { return; }); // Return nothing here.
    },
    
    xpwd(server, state, command, sendHandler){
        return this.pwd(server, state, command, sendHandler);
    }

};


module.exports = CommandHandler;


function createCommandRequest(request) {
    var commandSeparatorIndex = request.indexOf(" ");
    commandSeparatorIndex = 0 <= commandSeparatorIndex ? commandSeparatorIndex : request.indexOf("\r\n"); // Check for command with no arguments.
    var valid = 0 < commandSeparatorIndex;
    var result = {
        request,
        valid
    };

    if (valid) {
        result.argument = request.substring(commandSeparatorIndex + 1, request.length - 2); // Don't include the \r\n
        result.command = request.substring(0, commandSeparatorIndex).toUpperCase();
    }

    return result;
}

function escapePath(path) {
    // A single double quote character '"' should be replaced with two double quotes.
    var escapedPath = path.replace("\"", "\"\"");

    // Replace "device control two" with null.
    return escapedPath.replace("\u0012", "\u0000");
}
