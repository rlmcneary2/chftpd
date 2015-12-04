"use strict";

var React = require("react");

module.exports = React.createClass({
    
    render (){
        return (
            <div>
                <input autofocus="true" inputMode="url" placeholder="localhost" type="text" />
                <input inputMode="numeric" placeholder="21" type="text" />
                <button onClick={onstart}>Start</button>
            </div>
        );
    }

});

function onstart () {
    console.log("start clicked");
}