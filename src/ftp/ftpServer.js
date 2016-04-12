"use strict";


const CommandHandler = require("./CommandHandler");
const FtpPassiveServer = require("./FtpPassiveServer");
const log = require("../logging/logger");
const TcpServer = require("../tcp/TcpServer");


const _DEFAULT_STREAM_BUFFER_SIZE = 1024 * 100;


class FtpServer extends TcpServer {

    constructor() {
        super();
        this._port = 21;

        this._acceptEventHandler = acceptHandler.bind(this);
        this._commandHandler = new CommandHandler();
        this._logName = "FtpServer";
        this._receiveEventHandler = receiveHandler.bind(this);
        this._rootDirectoryEntry = null;
        this._rootDirectoryEntryId = null;
        this._sendEncoder = new TextEncoder("utf8");
        this._streamBufferSize = _DEFAULT_STREAM_BUFFER_SIZE;
        this._textDecoder = new TextDecoder("utf8");
        this._username = null;
        this._password = null;
        this.allowAnonymousLogin = true;
        this.loginMessage = ";-)";
    }

    close() {
        this.removeListener("accept", this._acceptEventHandler);
        this.removeListener("receive", this._receiveEventHandler);
        this._acceptEventHandler = null;
        this._commandHandler = null;
        this._receiveEventHandler = null;
        this._rootDirectoryEntry = null;
        this._rootDirectoryEntryId = null;
        this._sendEncoder = null;
        this._textDecoder = null;
        this._username = null;
        this._password = null;
        super.close();
    }

    createPassiveServer(clientSocket) {
        const ps = new FtpPassiveServer();
        ps.sendEncoder = this.sendEncoder;
        ps.binaryDataTransfer = clientSocket.binaryDataTransfer;
        clientSocket.passiveServer = ps;
        return Promise.resolve(ps.listen(this.address))
            .then(() => {
                log.verbose("ftpServer.createPassiveServer - finish.");
            });
    }

    get password() {
        return this._password;
    }

    get sendEncoder() {
        return this._sendEncoder;
    }

    get streamBufferSize() {
        return this._streamBufferSize;
    }

    get textDecoder() {
        return this._textDecoder;
    }

    get username() {
        return this._username;
    }

    getRootDirectoryEntry() {
        var self = this;
        return new Promise(function(resolve, reject) {
            if (self._rootDirectoryEntry !== null) {
                resolve(self._rootDirectoryEntry);
                return;
            }

            return self.getRootDirectoryEntryId()
                .then(function(id) {
                    if (!id) {
                        resolve(null);
                        return;
                    }

                    chrome.fileSystem.restoreEntry(id, function(entry) {
                        var err = chrome.runtime.lastError;
                        if (err) {
                            reject(err);
                            return;
                        }

                        self._rootDirectoryEntry = entry ? entry : null;
                        resolve(self._rootDirectoryEntry);
                    });
                });
        });
    }

    getRootDirectoryEntryId() {
        const self = this;
        return new Promise(function(resolve, reject) {
            if (self._rootDirectoryEntryId !== null) {
                resolve(self._rootDirectoryEntryId);
                return;
            }

            chrome.storage.local.get("rootEntryId", function(items) {
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

    listen(address) {
        this.addListener("accept", this._acceptEventHandler);
        this.addListener("receive", this._receiveEventHandler);
        return super.listen(address);
    }

    send(clientSocketId, message, binaryDataTransfer) {
        log.verbose(`ftpServer.send - message [${message.trim()}]`);
        let encodedMessage = null;
        if (binaryDataTransfer) {
            encodedMessage = this.sendEncoder.encode(message);
        } else {
            encodedMessage = new Int8Array(message.length);
            for (let i = 0; i < message.length; i++) {
                encodedMessage[i] = message.charCodeAt(i);
            }
        }

        return Promise.resolve(super.send(clientSocketId, encodedMessage.buffer))
            .then(result => {
                log.verbose(`ftpServer.send - result [${JSON.stringify(result)}].`);
            });
    }

    set streamBufferSize(size) {
        this._streamBufferSize = size;
    }

    setRootDirectoryEntryId(id) {
        const self = this;
        return new Promise(function(resolve, reject) {
            if (self._rootDirectoryEntryId === id) {
                resolve();
                return;
            }

            self._rootDirectoryEntryId = id ? id : null;
            self._rootDirectoryEntry = null;

            if (self._rootDirectoryEntryId === null) {
                chrome.storage.local.remove("rootEntryId", function() {
                    resolve();
                    return;
                });
            } else {
                chrome.storage.local.set({ rootEntryId: id }, function() {
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


module.exports = new FtpServer();


const _WELCOME_MESSAGE = "Welcome to chftpd.";


function acceptHandler(evt) {
    const cs = this.clientSockets.get(evt.clientSocketId);
    cs.binaryDataTransfer = true;

    const message = `220 ${_WELCOME_MESSAGE}${this.allowAnonymousLogin ? " Anonymous login allowed; please send email as password." : ""}\r\n`;
    this.send(evt.clientSocketId, message, true);
}

function createCommandRequest(request) {
    let commandSeparatorIndex = request.indexOf(" ");
    commandSeparatorIndex = 0 <= commandSeparatorIndex ? commandSeparatorIndex : request.indexOf("\r\n"); // Check for command with no arguments.
    const valid = 0 < commandSeparatorIndex;
    let result = {
        request,
        valid
    };

    if (valid) {
        result.argument = request.substring(commandSeparatorIndex + 1, request.length - 2); // Don't include the \r\n
        result.command = request.substring(0, commandSeparatorIndex).toUpperCase();
    }

    return result;
}

function receiveHandler(evt) {
    const cs = this.clientSockets.get(evt.clientSocketId);

    var dataView = new DataView(evt.data);
    var request = this.textDecoder.decode(dataView);
    log.verbose(`ftpServer.receiveHandler - receive from client socket ID ${evt.clientSocketId} request [${request.trim()}]`);

    this._commandHandler.handleRequest(this, cs, createCommandRequest(request));
}
