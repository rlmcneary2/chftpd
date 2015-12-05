"use strict";

var React = require("react");
var tcpServer = require("../tcp/tcpServer");

module.exports = React.createClass({
    
    getInitialState(){
        return { output: "waiting..." };
    },
    
    componentDidMount(){
    },
    
    render (){
        return (
            <div>
                <input autofocus="true" inputMode="url" placeholder="localhost" type="text" />
                <input inputMode="numeric" placeholder="21" type="text" />
                <button onClick={onstart.bind(this)}>Start</button>
                <pre>{this.state.output}</pre>
            </div>
        );
    }

});

function onstart () {
    this.setState({ output: "" });
    var self = this;
    Promise.resolve(tcpServer.startListening(function(arrBuffer){
        console.log("main.jsx onstart() - data received!");
        var dataView = new DataView(arrBuffer);
        var decoder = new TextDecoder("utf-8");
        var decodedString = decoder.decode(dataView);
        self.setState({ output: self.state.output + decodedString });
    }))
    .then(function(results){
        var message = "";
        results.forEach(r => message += `address: ${r.address}:${r.port}\r\n`);
        self.setState({ output: message });
    })
    .catch(function(err){
        console.error(`tcpServer error: ${err}.`);
    });
}