const React = require("react");


module.exports = (props) => {
    let options = null;
    if (props.interfaces) {
        options = props.interfaces.map(item => {
            return (<label><input value={item.name} type="checkbox" />{item.address}</label>);
        });
    }

    return (
        <div>
            {options}
        </div>
    );

};
