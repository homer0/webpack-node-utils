/* eslint strict: 0 */

'use strict';

module.exports = {
    onHandleCode(ev) {
        ev.data.code = ev.data.code
            .replace(/module\.exports = /g, 'export default ')
            .replace(/exports = /g, 'export default ');
    },
};
