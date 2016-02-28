"use strict";


var CommandHandler = require("./CommandHandler");
var FtpDataConnection = require("./FtpDataConnection");
var FtpCommandConnection = require("./FtpCommandConnection");
var log = require("../logging/logger");
var TcpServer = require("../tcp/TcpServer");


class FtpServer extends TcpServer {

    constructor() {
        super();
        this._port = 21;

        this._commandHandler = new CommandHandler();
        this._rootDirectoryEntry = null;
        this._rootDirectoryEntryId = null;
        this._sendEncoder = new TextEncoder("utf8");
        this._textDecoder = new TextDecoder("utf8");
        this._username = null;
        this._password = null;
        this.allowAnonymousLogin = true;
        this.loginMessage = ";-)";
    }

    close() {
        this._commandHandler = null;
        this._rootDirectoryEntry = null;
        this._rootDirectoryEntryId = null;
        this._sendEncoder = null;
        this._textDecoder = null;
        this._username = null;
        this._password = null;
        super.close();
    }

    createConnection() {
        const self = this;
        return this.getRootDirectoryEntryId()
            .then(rootDirectoryId => {
                const fc = new FtpCommandConnection();
                fc.sendEncoder = self._sendEncoder;
                fc.textDecoder = self._textDecoder;
                fc.currentDirectoryEntryId = rootDirectoryId;
                return fc;
            });
    }

    createPassiveDataConnection(ftpCommandConnection) {
        const fd = new FtpDataConnection();
        fd.sendEncoder = this._sendEncoder;
        fd.textDecoder = this._textDecoder;
        ftpCommandConnection.dataConnection = fd;
        return Promise.resolve(fd.listen(this.address))
            .then(() => {
                log.verbose("ftpServer.createPassiveDataConnection - finish.");
            });
    }

    get password() {
        return this._password;
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
        this.addListener("accept", acceptHandler.bind(this));
        return super.listen(address);
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
            //self._rootDirectoryEntryFullPath = null;

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


function acceptHandler(data) {
    const fc = this.getConnection(data.clientSocketId);
    fc.addListener("receive", receiveHandler.bind(this));

    const message = `220 ${_WELCOME_MESSAGE}${this.allowAnonymousLogin ? " Anonymous login allowed; please send email as password." : ""}\r\n`;
    fc.send(message);
}

function receiveHandler(data) {
    const fc = this.getConnection(data.clientSocketId);
    this._commandHandler.handleRequest(this, fc, data.command);
}
