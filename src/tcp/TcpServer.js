"use strict";


var EventEmitter = require("eventemitter3");
var logger = require("../logging/logger");


class TcpServer extends EventEmitter {

    constructor() {
        super();
        this.address = null;
        this.port = 0;
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
     * @param {number} socketId The clientSocketId returned to startListening's acceptCallback.
     * @param {ArrayBuffer} data The data to send.
     * @return {Promise|object} A Promise that resolves to information about the success or failure of the send attempt. 
     */    
    send(socketId, data){
        return tcpSend(socketId, data);
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

function tcpCreateAndListen(address, port) {
    var self = this;
    return new Promise(function (resolve, reject) {
        tcpCreate()
            .then(function (socketId) {
                tcpListen.call(self, socketId, address, port)
                    .then(function (listenData) {
                        resolve({ socketId, address, port: listenData.port });
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
                .then(function (outPort) {
                    resolve({ port: outPort });
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
                        return socketInfo.localPort;
                    });
            }
            else {
                return Promise.resolve(port);
            }
        })
        .then(function (outPort) {
            tcpAddOnAcceptHandler.call(self, socketId);
            return outPort;
        });
}

function tcpAddOnAcceptHandler(socketId) {
    var self = this;
    chrome.sockets.tcpServer.onAccept.addListener(function (acceptInfo) {
        logger.verbose(`tcpServer.js tcpAddOnAcceptHandler().onAccept() - acceptInfo: ${JSON.stringify(acceptInfo)}.`);
        if (acceptInfo.socketId !== socketId) {
            return;
        }

        logger.info(`tcpServer.js tcpAddOnAcceptHandler().onAccept() - acceptInfo: ${JSON.stringify(acceptInfo)}.`);
        
        self.emit("accept", acceptInfo);

        chrome.sockets.tcp.onReceive.addListener(receiveInfo => {
            //console.log(`tcpServer.js tcpAddOnAcceptHandler().onReceive() - receiveInfo: ${JSON.stringify(receiveInfo) }.`);
            if (receiveInfo.socketId === acceptInfo.clientSocketId) {
                self.emit("receive", { clientSocketId: receiveInfo.socketId, data: receiveInfo.data });
            }
        });

        chrome.sockets.tcp.setPaused(acceptInfo.clientSocketId, false);
    });
}

function tcpSend(socketId, data) {
    return new Promise(function (resolve, reject) {
        console.log(`tcpServer.js tcpSend() - sending to ${socketId}.`);
        chrome.sockets.tcp.send(socketId, data, sendInfo => {
            resolve(sendInfo);
        });
    });
}
