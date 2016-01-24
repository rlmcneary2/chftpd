"use strict";


var TcpServer = require("../tcp/TcpServer");
var CommandHandler = require("./CommandHandler");


class FtpServer extends TcpServer{

    getAllowAnonymousLogin() {
        return _allowAnonymousLogin;
    }

    getControlPort() {
        return this.port;
    }

    getLoginMessage() {
        return _loginMessage;
    }

    getPassword() {
        return _password;
    }

    getRootDirectoryEntry() {
        return new Promise(function (resolve, reject) {
            if (_rootDirectoryEntry !== null) {
                resolve(_rootDirectoryEntry);
                return;
            }

            return getRootDirectoryEntryId()
                .then(function (id) {
                    if (!id) {
                        resolve(null);
                        return;
                    }

                    chrome.fileSystem.restoreEntry(id, function (entry) {
                        var err = chrome.runtime.lastError;
                        if (err) {
                            reject(err);
                            return;
                        }

                        _rootDirectoryEntry = entry ? entry : null;
                        resolve(_rootDirectoryEntry);
                    });
                });
        });
    }

    getRootDirectoryEntryFullPath() {
        var self = this;
        return new Promise(function (resolve) {
            if (_rootDirectoryEntryFullPath !== null) {
                resolve(_rootDirectoryEntryFullPath);
                return;
            }

            self.getRootDirectoryEntry()
                .then(function (entry) {
                    if (!entry) {
                        resolve(null);
                        return;
                    }
                    chrome.fileSystem.getDisplayPath(entry, function (path) {
                        resolve(path);
                    });
                });
        });
    }

    getUsername() {
        return _username;
    }

    setAllowAnonymousLogin(allow) {
        _allowAnonymousLogin = allow;
        _username = allow ? "anonymous" : _username;
    }

    /**
     * A message to display after the user successfully logs in.
     * @param {string|string[]} message The message to display, Passing an array will cause more than one message line to be returned to the client. Do not include any FTP response codes in the message.
     */    
    setLoginMessage(message) {
        _loginMessage = message;
    }

    setPassword(password) {
        _password = password;
    }

    setRootDirectoryEntryId(id) {
        return new Promise(function (resolve, reject) {
            if (_rootDirectoryEntryId === id){
                resolve();
                return;
            }

            _rootDirectoryEntryId = id ? id : null;
            _rootDirectoryEntry = null;
            _rootDirectoryEntryFullPath = null;

            if (_rootDirectoryEntryId === null) {
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

    setUsername(username) {
        _username = username;
    }

    /**
     * Start listening for FTP connections from clients.
     * @param {string} address The address to bind to.
     * @returns {Promise|object} A Promise that resolves to an object with information.
     */    
    startListening(address) {
        var self = this;
        return super.startListening(address, {

            acceptCallback(data) {
                acceptCallbackHandler.call(self, data);
            },

            receiveCallback(receiveInfo) {
                receiveCallbackHandler.call(self, receiveInfo);
            }

        });
    }

}


const _WELCOME_MESSAGE = "Welcome to chftpd.";


var _allowAnonymousLogin = true;
var _commandHandler = new CommandHandler();
var _loginMessage = ";-)";
var _password = null;
var _rootDirectoryEntry = null;
var _rootDirectoryEntryId = null;
var _rootDirectoryEntryFullPath = null;
var _sendEncoder = new TextEncoder("utf8");
var _socketState = {};
var _textDecoder = new TextDecoder("utf8");
var _username = "anonymous";


function acceptCallbackHandler(data) {
    console.log(`ftpServer.js acceptCallbackHandler() - ${JSON.stringify(data) }.`);

    _socketState[data.clientSocketId] = {
        lastRequestTime: Date.now(),
        fileTransferType: "A" // Default to ASCII file type.
    };
    
    var message = `220 ${_WELCOME_MESSAGE}${this.getAllowAnonymousLogin() ? " Anonymous login allowed; please send email as password." : ""}\r\n`;
    
    // Create the FTP connection request ack ArrayBuffer.
    var response = _sendEncoder.encode(message);
    this.send(data.clientSocketId, response.buffer)
        .then(result => {
            console.log(`ftpServer.js acceptCallbackHandler().then() - ${JSON.stringify(result) }.`);
        });
}

function getRootDirectoryEntryId() {
    return new Promise(function (resolve, reject) {
        if (_rootDirectoryEntryId !== null) {
            resolve(_rootDirectoryEntryId);
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

function receiveCallbackHandler(receiveInfo) {
    var dataView = new DataView(receiveInfo.data);
    var request = _textDecoder.decode(dataView);
    console.log(`ftpServer.js receiveCallbackHandler() - request [${request.trim()}]`);

    var state = _socketState[receiveInfo.clientSocketId];

    _commandHandler.handleRequest(this, state, request, message => {
        console.log(`ftpServer.js receiveCallbackHandler() - response [${message.trim()}]`);
        var encodedMessage = _sendEncoder.encode(message);
        return this.send(receiveInfo.clientSocketId, encodedMessage.buffer);
    })
        .then(result => {
            state.lastRequestTime = Date.now();
            this.emit("command-arrived", result.command.request);
        });
}


module.exports = new FtpServer();
