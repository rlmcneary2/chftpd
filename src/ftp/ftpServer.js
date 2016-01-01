"use strict";


var TcpServer = require("../tcp/TcpServer");


class FtpServer extends TcpServer{
    
    getControlPort(){
        return this.port;
    }

    /**
     * Start listening for FTP connections from clients.
     * @param {string} address The address to bind to.
     * @returns {Promise|object} A Promise that resolves to an object with information.
     */    
    startListening(address) {
        var self = this;
        return super.startListening(address, {

            acceptCallback(data) {
                acceptCallbackHandler.call(self, data);
            },

            receiveCallback(response) {
                console.log(`ftpServer.js startListening().receiveCallback() - ${JSON.stringify(response) }.`);
                self.emit("response-arrived", response.data);
            }

        });
    }

}


var _activeSocketIds = [];


function acceptCallbackHandler(data) {
    console.log(`ftpServer.js acceptCallbackHandler() - ${JSON.stringify(data) }.`);

    _activeSocketIds.push({ id: data.clientSocketId, lastRequest: Date.now() });
    
    // Create the FTP connection request ack ArrayBuffer.
    var encoder = new TextEncoder("utf8");
    var response = encoder.encode("220 Welcome to chftpd.\r\n");
    this.send(data.clientSocketId, response.buffer)
        .then(result => {
            console.log(`ftpServer.js acceptCallbackHandler().then() - ${JSON.stringify(result) }.`);
        });
}


module.exports = new FtpServer();
