"use strict";

var React = require("react");
var TcpServer = require("../tcp/TcpServer");

var _tcpServer = new TcpServer();

module.exports = React.createClass({
    
    getInitialState(){
        return { selectedInterfaceIndex: -1, ftpPort: "-", interfaces:null, output: "waiting..." };
    },
    
    componentDidMount(){
        componentMounted.bind(this)();
    },
    
    render (){
        var interfaces = null;
        var selectedName = null;
        if (this.state.interfaces !== null && 0 < this.state.interfaces.length){
            interfaces = this.state.interfaces.map(function(ni){
                return(
                    <option key={ni.name} value={ni.name}>{ni.address}</option>                
                );
            });
            
            selectedName = this.state.selectedInterfaceIndex < 0 ? "" : this.state.interfaces[this.state.selectedInterfaceIndex].name; 
        }

        var select = (
            <select value={selectedName} onChange={interfaceSelected.bind(this)}>{interfaces}</select>
        );
    
        return (
            <div>
                <section>
                    <span>Available network interfaces</span>{select}
                    <p><span>port: {this.state.ftpPort}</span></p>
                    <button onClick={startServer.bind(this)}>Start</button>
                </section>
                <pre>{this.state.output}</pre>
            </div>
        );
    }

});


function componentMounted(){
    var self = this;
    _tcpServer.getNetworkInterfaces()
        .then(function(interfaces){
            self.setState({interfaces, selectedInterfaceIndex: 0}); 
        });
}

function interfaceSelected(evt){
    if (evt.target.selectedIndex < 0){
        return;
    }

    this.setState({selectedInterfaceIndex: evt.target.selectedIndex});
}

function startServer () {
    if (this.state.selectedInterfaceIndex < 0){
        return;
    }

    this.setState({ output: "" });
    
    var address = this.state.interfaces[this.state.selectedInterfaceIndex].address;
    var self = this;
    Promise.resolve(_tcpServer.startListening(address, function(arrBuffer){
        var dataView = new DataView(arrBuffer);
        var decoder = new TextDecoder("utf-8");
        var decodedString = decoder.decode(dataView);
        self.setState({ output: self.state.output + decodedString });
    }))
    .then(function(result){
        var message = self.state.output;
        message += `address: ${result.address}:${result.port}\r\n`;
        self.setState({ ftpPort: result.port, output: message });
    })
    .catch(function(err){
        console.error(`_tcpServer error: ${err}.`);
    });
}