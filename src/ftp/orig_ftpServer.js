"use strict";


var CommandHandler = require("./CommandHandler");
var DataConnection = require("./DataConnection");
var log = require("../logging/logger");
var TcpServer = require("../tcp/TcpServer");


class FtpServer extends TcpServer{
    
    constructor(){
        super();
        this.name = "FtpServer";
        this.port = 21;
    }
    
    close() {
        _socketState.forEach((val, key) => {
            let connection = this.getConnection(key);
            if (!connection) {
                return;
            }

            connection.removeListener("receive", val.receiveHandler);
        });
        
        _socketState.clear();

        super.close();
    }

    createPassiveDataConnection(state) {
        log.verbose("ftpServer.createPassiveDataConnection() - start.");
        const passiveDataConnection = new DataConnection();
        passiveDataConnection.sendEncoder = _sendEncoder;
        passiveDataConnection.textDecoder = _textDecoder;
        state.dataConnection = passiveDataConnection;
        return Promise.resolve(passiveDataConnection.listen(this.address))
            .then(() => {
                log.verbose("ftpServer.createPassiveDataConnection() - finish.");
            });
    }

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

    /**
     * Start listening for FTP connections from clients.
     * @param {string} address The address to bind to.
     * @returns {Promise|object} A Promise that resolves to an object with information.
     */    
    listen(address) {
        var self = this;
        this.addListener("accept", data => {
            onAcceptEvent.call(self, data);
        });

        return super.listen(address);
    }

    send(clientSocketId, message) {
        let connection = this.getConnection(clientSocketId);
        if (!connection) {
            log.warning(`ftpServer.send - no connection for client socket ${clientSocketId}.`);
            return;
        }

        let response = _sendEncoder.encode(message);
        return connection.send(clientSocketId, response.buffer)
            .then(result => {
                log.verbose(`ftpServer.send - result: ${JSON.stringify(result)}.`);
            });
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
var _socketState = new Map();
var _textDecoder = new TextDecoder("utf8");
var _username = "anonymous";


function onAcceptEvent(data) {
    log.info(`ftpServer onAcceptEvent() - ${JSON.stringify(data)}.`);
    
    var socketState = {
        binaryFileTransfer: false, // Default to binary file type.
        clientSocketId: data.clientSocketId,
        acceptTime: Date.now(),
        receiveHandler: function(info) { onReceiveEvent(info); }.bind(this)
    };

    _socketState.set(data.clientSocketId, socketState);

    let connection = this.getConnection(data.clientSocketId);
    if (connection) {
        connection.addListener("receive", socketState.receiveHandler);
    }

    var message = `220 ${_WELCOME_MESSAGE}${this.getAllowAnonymousLogin() ? " Anonymous login allowed; please send email as password." : ""}\r\n`;

    // Create the FTP connection request ack ArrayBuffer.
    var response = _sendEncoder.encode(message);
    connection.send(data.clientSocketId, response.buffer);
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

function onReceiveEvent(receiveInfo) {
    log.verbose(`ftpServer.js onReceiveEvent() - receiveInfo: [${JSON.stringify(receiveInfo)}]`);
    var dataView = new DataView(receiveInfo.data);
    var request = _textDecoder.decode(dataView);
    log.info(`ftpServer.js onReceiveEvent() - request [${request.trim()}]`);
    
    if (!_socketState.has(receiveInfo.clientSocketId)){
        log.warning(`ftpServer onReceiveEvent - no client socket ${receiveInfo.clientSocketId} exists.`);
        return;
    }

    var state = _socketState.get(receiveInfo.clientSocketId);

    _commandHandler.handleRequest(this, state, request, message => {
        log.info(`ftpServer.js onReceiveEvent() - response: [${message.trim()}]`);
        
        // TODO: refactor - shared with DataConnection.
        let encodedMessage = null;
        if (state.binaryFileTransfer) {
            encodedMessage = _sendEncoder.encode(message);
        } else {
            encodedMessage = new Int8Array(message.length);
            for (let i = 0; i < message.length; i++){
                encodedMessage[i] = message.charCodeAt(i);
            }
        }

        return this.send(receiveInfo.clientSocketId, encodedMessage.buffer);
    })
        .then(result => {
            state.lastRequestTime = Date.now();
            this.emit("command-arrived", result.command.request);
        });
}


module.exports = new FtpServer();
