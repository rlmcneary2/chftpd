"use strict";


var EventEmitter = require("eventemitter3");


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
     * @param {object} options An object with properties needed to process requests and responses.
     * @param {function} options.acceptCallback This function will be invoked when a connection is accepted.
     * @param {function} options.receiveCallback Invoked when data is received from an accepted connection.
     * @returns {Promise|object} A Promise that resolves to an object with socket information.
     */
    startListening(address, options) {
        this.address = address;
        return tcpCreateAndListen(this.address, this.port, options);
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

function tcpCreateAndListen(address, port, options) {
    return new Promise(function (resolve, reject) {
        tcpCreate()
            .then(function (socketId) {
                tcpListen(socketId, address, port, options)
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

function tcpListen(socketId, address, port, options) {
    return new Promise(function (resolve, reject) {
        console.log(`tcpServer tcpListen() - address: ${address}, port: ${port}.`);
        chrome.sockets.tcpServer.listen(socketId, address, port, function (result) {
            Promise.resolve(tcpListenHandler(result, socketId, port, options))
                .then(function (outPort) {
                    resolve({ port: outPort });
                });
        });
    });
}

function tcpListenHandler(result, socketId, port, options) {
    if (result < 0) {
        throw `tcpServer.js tcpListenHandler() - listen error result: ${result}.`;
    }

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
            tcpAddOnAcceptHandler(socketId, options.acceptCallback, options.receiveCallback);
            return outPort;
        });
}

function tcpAddOnAcceptHandler(socketId, acceptCallback, receiveCallback) {
    chrome.sockets.tcpServer.onAccept.addListener(function (acceptInfo) {
        console.log(`tcpServer.js tcpAddOnAcceptHandler().onAccept() - acceptInfo: ${JSON.stringify(acceptInfo)}.`);
        if (acceptInfo.socketId !== socketId) {
            return;
        }
        
        // TODO: FTP server must acknowledge the connection here.
        if (acceptCallback) {
            acceptCallback(acceptInfo);
        }
        
        // TODO: No callbacks, raise an event.
        this.emit("accept", acceptInfo);

        chrome.sockets.tcp.onReceive.addListener(receiveInfo => {
            //console.log(`tcpServer.js tcpAddOnAcceptHandler().onReceive() - receiveInfo: ${JSON.stringify(receiveInfo) }.`);
            if (receiveInfo.socketId === acceptInfo.clientSocketId && receiveCallback) {
                receiveCallback({ clientSocketId: receiveInfo.socketId, data: receiveInfo.data });

                // TODO: No callbacks, raise an event.
                this.emit("receive", { clientSocketId: receiveInfo.socketId, data: receiveInfo.data });
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
