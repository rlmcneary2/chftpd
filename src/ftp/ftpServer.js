"use strict";


var CommandHandler = require("./CommandHandler");
var FtpDataConnection = require("./FtpDataConnection");
var FtpCommandConnection = require("./FtpCommandConnection");
var log = require("../logging/logger");
var TcpServer = require("../tcp/TcpServer");


class FtpServer extends TcpServer {

    constructor() {
        super();
        this._commandHandler = new CommandHandler();
        this._rootDirectoryEntryId = null;
        this._sendEncoder = new TextEncoder("utf8");
        this._textDecoder = new TextDecoder("utf8");
        this.allowAnonymousLogin = true;
        this.port = 21;
    }

    createConnection() {
        return this.getRootDirectoryEntryId()
            .then(rootDirectoryId => {
                const fc = new FtpCommandConnection();
                fc.currentDirectoryEntryId = rootDirectoryId;
                fc.sendEncoder = this._sendEncoder;
                fc.textDecoder = this._textDecoder;
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

    getRootDirectoryEntryId() {
        var self = this;
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

}


module.exports = new FtpServer();


const _WELCOME_MESSAGE = "Welcome to chftpd.";


function acceptHandler(data) {
    const fc = this.getConnection(data.clientSocketId);
    fc.addListener("receive", receiveHandler.bind(this));

    const message = `220 ${_WELCOME_MESSAGE}${this.allowAnonymousLogin ? " Anonymous login allowed; please send email as password." : ""}\r\n`;
    const response = this._sendEncoder.encode(message);
    fc.send(response.buffer);
}

function receiveHandler(data) {
    const fc = this.getConnection(data.clientSocketId);
    this._commandHandler.handleRequest(this, fc, data.command, message => {
        log.info(`ftpServer.js receiveHandler - response: [${message.trim()}]`);
        return fc.send(message);
    });
}
