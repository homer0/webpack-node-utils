module.exports = () => ({
  extends: 'base',
  name: 'app-production',
});

module.exports.custom = (params) => ({
  name: 'app-production-custom',
  params,
});
