"use strict";

const {createStore, applyMiddleware} = require("redux");
const {Provider} = require("react-redux");
var React = require("react");
var ReactDOM = require("react-dom");
const reducer = require("./reducer/reducers");
const thunk = require("redux-thunk").default;

const store = createStore(reducer, applyMiddleware(thunk));

var main = React.createElement(require("./view/main.jsx"));
ReactDOM.render((<Provider id="provider" store={store}>{main}</Provider>), document.getElementById("main_content"));
