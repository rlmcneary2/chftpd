"use strict";


var log = require("../logging/logger");


module.exports = {
    
    tcpClose(socketId){
        return new Promise(resolve =>{
            chrome.sockets.tcp.close(socketId, () => {
                resolve();
            });
        });
    },

    tcpCreate() {
        return new Promise(resolve => {
            chrome.sockets.tcpServer.create({}, function(createInfo) {
                log.verbose(`tcpAsync.js tcpCreate - socketId ${createInfo.socketId}.`);
                resolve(createInfo.socketId);
            });
        });
    },

    tcpGetSocketInfo(socketId) {
        return new Promise(function(resolve, reject) {
            chrome.sockets.tcpServer.getInfo(socketId, function(socketInfo) {
                let lastErr = chrome.runtime.lastError;
                //log.verbose(`tcpAsync.js tcpGetSocketInfo() - socketInfo: ${JSON.stringify(socketInfo)}.`);
                resolve(socketInfo);
            });
        });
    },

    tcpListen(socketId, address, port) {
        return new Promise(function(resolve) {
            log.verbose(`tcpAsync.js tcpListen - address: ${address}, port: ${port}.`);
            chrome.sockets.tcpServer.listen(socketId, address, port, () => {
                resolve();
            });
        });
    },

    tcpServerClose(socketId, acceptHandler) {
        return new Promise((resolve) => {
            log.verbose(`tcpAsync.js tcpServerClose - removing listener for socket ${socketId}.`);
            chrome.sockets.tcpServer.onAccept.removeListener(acceptHandler);
            chrome.sockets.tcpServer.close(socketId, () => {
                log.verbose(`tcpAsync.js tcpServerClose - socket ${socketId} closed.`);
                resolve();
            });
        });
    }

};
