"use strict";


var TcpServer = require("../tcp/TcpServer");


class FtpServer extends TcpServer{
    
    getControlPort(){
        return this.port;
    }
    
    startListening(address) {
        var self = this;
        return super.startListening(address, function (responseBody) {
            self.emit("response-arrived", responseBody);
        });
    }

}

module.exports = new FtpServer();
