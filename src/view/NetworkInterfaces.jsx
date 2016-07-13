const React = require("react");


module.exports = (props) => {
    let interfaces = null;
    if (props.interfaces) {
        interfaces = props.interfaces.map(item => {
            return (<li key={item.name}><label><input type="checkbox" {...item} />{item.address}</label></li>);
        });
    }

    return (
        <ul id="network-interfaces">
            {interfaces}
        </ul>
    );
};
