"use strict";

var React = require("react");
var ReactDOM = require("react-dom");

var main = React.createElement(require("./view/main.jsx"));
ReactDOM.render(main, document.getElementById("main_content"));
