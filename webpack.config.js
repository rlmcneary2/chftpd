module.exports = {
    module: {
        loaders: [
            {
                loader: "babel-loader",
                query: {
                    presets: ["react"]
                },
                test: /.jsx?$/
            }
        ]
    }
};
