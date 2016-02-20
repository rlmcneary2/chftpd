"use strict";


var EventEmitter = require("eventemitter3");
var logger = require("../logging/logger");


class TcpServer extends EventEmitter {

    constructor() {
        super();
        this._clientSocketIds = new Map();
        this.address = null;
        this.port = 0;
        this.socketId = -1;

        this.acceptHandler = function(acceptInfo) {
            logger.verbose(`TcpServer.acceptHandler() - acceptInfo: ${JSON.stringify(acceptInfo)}.`);
            if (acceptInfo.socketId !== this.socketId) {
                return;
            }

            this._clientSocketIds.set(acceptInfo.clientSocketId, acceptInfo);
            //this.emit("accept", acceptInfo);
            this.emit("accept", { clientSocketId: acceptInfo.clientSocketId });
            chrome.sockets.tcp.setPaused(acceptInfo.clientSocketId, false);
        }.bind(this);

        this.receiveHandler = function(receiveInfo) {
            logger.verbose(`TcpServer.receiveHandler() - receiveInfo: ${JSON.stringify(receiveInfo)}.`);
            if (!this._clientSocketIds.has(receiveInfo.socketId)) {
                return;
            }

            this.emit("receive", { clientSocketId: receiveInfo.socketId, data: receiveInfo.data });
        }.bind(this);
    }

    close() {
        var self = this;
        return tcpClose.call(this)
            .then(() => {
                self._clientSocketIds.clear();
            });
    }

    getNetworkInterfaces() {
        return getIPv4NetworkInterfaces();
    }

    /**
     * Start listening for connections from clients.
     * @param {string} address The network interface address to bind to.
     * @returns {Promise|object} A Promise that resolves to an object with socket information.
     */
    startListening(address) {
        this.address = address;
        return tcpCreateAndListen.call(this, this.address, this.port);
    }

    /**
     * Send data to a client.
     * @param {number} clientSocketId The clientSocketId returned to startListening's acceptCallback.
     * @param {ArrayBuffer} data The data to send.
     * @return {Promise|object} A Promise that resolves to information about the success or failure of the send attempt. 
     */    
    send(clientSocketId, data){
        // TODO: now know the socketId ourselves, no need for the parameter here.
        return tcpSend(clientSocketId, data);
    }

}


module.exports = TcpServer;


function getIPv4NetworkInterfaces() {
    return new Promise(function (resolve, reject) {
        chrome.system.network.getNetworkInterfaces(function (networkInterfaces) {
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
        logger.verbose(`TcpServer.js tcpClose() - removing listeners for socket ${self.socketId}.`);
        chrome.sockets.tcpServer.onAccept.removeListener(self.acceptHandler);
        chrome.sockets.tcp.onReceive.removeListener(self.receiveHandler);
        chrome.sockets.tcpServer.close(self.socketId, () => {
            logger.verbose(`TcpServer.js tcpClose() - socket ${self.socketId} closed.`);
            resolve();
        });
    });
}

function tcpCreateAndListen(address, port) {
    var self = this;
    return new Promise(function (resolve, reject) {
        tcpCreate()
            .then(function (socketId) {
                self.socketId = socketId;
                tcpListen.call(self, socketId, address, port)
                    .then(function () {
                        resolve();
                    });
            });
    });
}

function tcpCreate() {
    return new Promise(function (resolve, reject) {
        chrome.sockets.tcpServer.create({ name: "chftpd" }, function (createInfo) {
            console.log(`tcpServer.js tcpCreate() - socketId ${createInfo.socketId}.`);
            resolve(createInfo.socketId);
        });
    });
}

function tcpGetSocketInfo(socketId) {
    return new Promise(function (resolve, reject) {
        chrome.sockets.tcpServer.getInfo(socketId, function (socketInfo) {
            console.log(`tcpServer.js tcpGetSocketInfo() - socketInfo: ${JSON.stringify(socketInfo) }.`);
            resolve (socketInfo);
        });
    });
}

function tcpListen(socketId, address, port) {
    var self = this;
    return new Promise(function (resolve, reject) {
        console.log(`tcpServer tcpListen() - address: ${address}, port: ${port}.`);
        chrome.sockets.tcpServer.listen(socketId, address, port, function (result) {
            Promise.resolve(tcpListenHandler.call(self, result, socketId, port))
                .then(function () {
                    resolve();
                });
        });
    });
}

function tcpListenHandler(result, socketId, port) {
    if (result < 0) {
        throw `tcpServer.js tcpListenHandler() - listen error result: ${result}.`;
    }

    var self = this;
    return Promise.resolve()
        .then(function () {
            if (port === 0) {
                return tcpGetSocketInfo(socketId)
                    .then(function (socketInfo) {
                        self.port = socketInfo.localPort;
                        return;
                    });
            }
            else {
                return Promise.resolve();
            }
        })
        .then(function() {
            chrome.sockets.tcpServer.onAccept.addListener(self.acceptHandler);
            chrome.sockets.tcp.onReceive.addListener(self.receiveHandler);
            return;
        });
}

function tcpSend(clientSocketId, data) {
    return new Promise(function (resolve, reject) {
        console.log(`tcpServer.js tcpSend() - sending to client socket ID ${clientSocketId}.`);
        chrome.sockets.tcp.send(clientSocketId, data, sendInfo => {
            resolve(sendInfo);
        });
    });
}
