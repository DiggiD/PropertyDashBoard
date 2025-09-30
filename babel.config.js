export default {
  presets: [['@babel/preset-env', { targets: { node: '18' }, modules: 'commonjs' }]],
  plugins: [],
  ignore: ['**/node_modules/**']
};
