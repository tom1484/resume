const path = require('path');

module.exports = {
    webpack: {
        alias: {
            '@css': path.resolve(__dirname, 'src/css'),
            '@components': path.resolve(__dirname, 'src/components'),
            '@config': path.resolve(__dirname, 'src/config'),
            '@contexts': path.resolve(__dirname, 'src/contexts'),
            '@hooks': path.resolve(__dirname, 'src/hooks'),
            '@data': path.resolve(__dirname, 'src/data'),
            '@utils': path.resolve(__dirname, 'src/utils'),
        },
    },
};
