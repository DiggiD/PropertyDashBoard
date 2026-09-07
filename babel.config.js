export default {
  presets: [
    ['@babel/preset-env', { targets: { node: '18' }, modules: 'commonjs' }],
    ['@babel/preset-typescript', { allowDeclareFields: true }],
  ],
  plugins: [],
  ignore: ['**/node_modules/**']
};
