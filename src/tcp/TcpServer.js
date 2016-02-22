"use strict";


var EventEmitter = require("eventemitter3");
var log = require("../logging/logger");
var TcpConnection = require("./TcpConnection");


class TcpServer extends EventEmitter {

    constructor() {
        super();
        this._connections = new Map();
        this.address = null;
        this.name = "TcpServer";
        this.port = 0;
        this.socketId = -1;

        this._acceptHandler = function(info) {
            log.verbose(`TcpServer._acceptHandler - server socket: ${this.socketId}, acceptInfo: ${JSON.stringify(info)}.`);
            if (this.socketId !== info.socketId) {
                return;
            }

            var connection = new TcpConnection();
            this._connections.set(info.clientSocketId, connection);

            var self = this;
            connection.listen(info.clientSocketId)
                .then(c => {
                    self.emit("accept", { clientSocketId: c.socketId });
                });
        }.bind(this);
    }

    close() {
        var self = this;
        return tcpClose.call(this)
            .then(() => {
                self._connections.clear();
            });
    }

    getConnection(clientSocketId) {
        if (!this._connections.has(clientSocketId)) {
            return null;
        }

        return this._connections.get(clientSocketId);
    }

    getNetworkInterfaces() {
        return getIPv4NetworkInterfaces();
    }

    /**
     * Start listening for connections from clients.
     * @param {string} address The network interface address to bind to.
     * @returns {Promise|object} A Promise that resolves to an object with socket information.
     */
    listen(address) {
        this.address = address;
        var self = this;
        return tcpCreate()
            .then(socketId => {
                self.socketId = socketId;
                return tcpGetSocketInfo(self.socketId);
            })
            .then(info => {
                self.port = info.localPort;
                chrome.sockets.tcpServer.onAccept.addListener(self._acceptHandler);
                return tcpListen(self.socketId, self.address, self.port);
            })
            .then(() => {
                return new Promise(resolve => {
                    chrome.sockets.tcpServer.setPaused(self.socketId, false, () => {
                        log.verbose(`TcpServer.listen - server socket ${self.socketId} on port ${self.port} accepting connections.`);
                        resolve();
                    });
                });
            });
    }
}


module.exports = TcpServer;


function disconnectSocketHandlers() {
    let promises = this._connections.forEach(val => {
        return val.close();
    }, this);

    return Promise.all(promises);
}

function getIPv4NetworkInterfaces() {
    return new Promise(function(resolve, reject) {
        chrome.system.network.getNetworkInterfaces(function(networkInterfaces) {
            var err = chrome.runtime.lastError;
            if (err) {
                reject(err);
            }

            if (typeof networkInterfaces === "undefined" || networkInterfaces === null) {
                resolve([]);
            }

            var interfaces = [];
            for (var i = 0; i < networkInterfaces.length; i++) {
                // This test is probably guaranteed to fail someday. If there is no ':' then it is not an IPv6 address.
                if (networkInterfaces[i].address.indexOf(":") < 0) {
                    interfaces.push(networkInterfaces[i]);
                }
            }

            resolve(interfaces);
        });
    });
}

function tcpClose() {
    var self = this;
    return new Promise((resolve) => {
        log.verbose(`TcpServer.js tcpClose() - removing listeners for socket ${self.socketId}.`);
        chrome.sockets.tcpServer.onAccept.removeListener(self._acceptHandler);
        disconnectSocketHandlers.call(self)
            .then(() => {
                chrome.sockets.tcpServer.close(self.socketId, () => {
                    log.verbose(`TcpServer.js tcpClose() - socket ${self.socketId} closed.`);
                    resolve();
                });
            });
    });
}

// function tcpSocketClose(clientSocketId) {
//     return new Promise((resolve) => {
//         chrome.sockets.tcp.close(clientSocketId, () => {
//             log.verbose(`TcpServer.js tcpSocketClose() - socket ${clientSocketId} closed.`);
//             resolve();
//         });
//     });
// }

// function tcpCreateAndListen(address, port) {
//     var self = this;
//     return new Promise(function(resolve, reject) {
//         tcpCreate()
//             .then(function(socketId) {
//                 self.socketId = socketId;
//                 tcpListen.call(self, socketId, address, port)
//                     .then(function() {
//                         resolve();
//                     });
//             });
//     });
// }

function tcpCreate() {
    return new Promise(resolve => {
        chrome.sockets.tcpServer.create({ name: "chftpd" }, function(createInfo) {
            log.verbose(`TcpServer.js tcpCreate - socketId ${createInfo.socketId}.`);
            resolve(createInfo.socketId);
        });
    });
}

function tcpGetSocketInfo(socketId) {
    return new Promise(function(resolve, reject) {
        chrome.sockets.tcpServer.getInfo(socketId, function(socketInfo) {
            log.verbose(`TcpServer.js tcpGetSocketInfo() - socketInfo: ${JSON.stringify(socketInfo)}.`);
            resolve(socketInfo);
        });
    });
}

function tcpListen(socketId, address, port) {
    var self = this;
    return new Promise(function(resolve) {
        log.verbose(`TcpServer.js tcpListen() - address: ${address}, port: ${port}.`);
        chrome.sockets.tcpServer.listen(socketId, address, port, () => {
            chrome.sockets.tcpServer.onAccept.addListener(self._acceptHandler);
            resolve();
        });
    });
}

// function tcpListenHandler(result, socketId, port) {
//     if (result < 0) {
//         throw `TcpServer.js tcpListenHandler() - listen error result: ${result}.`;
//     }

//     var self = this;
//     return Promise.resolve()
//         .then(function() {
//             if (port === 0) {
//                 return tcpGetSocketInfo(socketId)
//                     .then(function(socketInfo) {
//                         self.port = socketInfo.localPort;
//                         return;
//                     });
//             }
//             else {
//                 return Promise.resolve();
//             }
//         })
//         .then(function() {
//             chrome.sockets.tcpServer.onAccept.addListener(self._acceptHandler);
//             return;
//         });
// }
