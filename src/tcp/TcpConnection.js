"use strict";


var EventEmitter = require("eventemitter3");
var log = require("../logging/logger");


class TcpConnection extends EventEmitter {

    constructor() {

        this._onReceiveHandler = function(info) {
            const arrived = Date.now();
            if (!this._socketId === info.socketId) {
                return;
            }

            log.verbose(`TcpConnection._onReceiveHandler - receive from client socket ID: ${info.socketId}.`);
            this.emit("receive", { arrived, clientSocketId: info.socketId, data: info.data });
        }.bind(this);

        this._onReceiveErrorHandler = function(info) {
            if (!this._socketId === info.socketId) {
                return;
            }

            log.warning(`TcpConnection._onReceiveErrorHandler - info: ${JSON.stringify(info)}`);
            this.emit("error", info);
        }.bind(this);

        this._socketId;
    }

    get socketId() {
        return this._socketId;
    }

    close() {
        var self = this;
        return new Promise(resolve => {
            disconnectSocketHandlers.call(self);
            chrome.sockets.tcp.close(self._socketId, () => {
                log.verbose(`TcpConnection.close - client socket ${self._socketId} closed.`);
                resolve();
            });
        });
    }

    listen(clientSocketId) {
        this._socketId = clientSocketId;
        var self = this;
        return new Promise(resolve => {
            connectSocketHandlers.call(self);
            chrome.sockets.tcp.setPaused(self._socketId, false, () => {
                log.verbose(`TcpConnection.listen - client socket ${self._socketId} un-paused.`);
                resolve(self);
            });
        });
    }

    /**
     * Send information to the client.
     * @param {ArrayBuffer} data The information to send to the client.
     * @returns {Promise|object} A Promise that resolves to a result code after the data is sent. 
     */
    send(data) {
        var self = this;
        return new Promise(function(resolve, reject) {
            log.verbose(`TcpConnection.send - client socket ${self._socketId} sent.`);
            chrome.sockets.tcp.send(self._socketId, data, sendInfo => {
                if (sendInfo.resultCode < 0) {
                    reject(sendInfo);
                    return;
                }

                resolve(sendInfo);
            });
        });
    }

}


module.exports = TcpConnection;


function connectSocketHandlers() {
    chrome.sockets.tcp.onReceive.addListener(this._onReceiveHandler);
    chrome.sockets.tcp.onReceiveError.addListener(this._onReceiveErrorHandler);
}

function disconnectSocketHandlers() {
    chrome.sockets.tcp.onReceive.removeListener(this._onReceiveHandler);
    chrome.sockets.tcp.onReceiveError.removeListener(this._onReceiveErrorHandler);
}
