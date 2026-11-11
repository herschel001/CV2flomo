import CopyWebpackPlugin from 'copy-webpack-plugin';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
export default {
  entry: {
    'background/background': './src/background/background.js',
    'content/content': './src/content/content.js',
    'popup/popup': './src/popup/popup.js',
    'options/options': './src/options/options.js'
  },
  output: {
    path: path.join(root, 'dist'),
    filename: 'src/[name].js',
    clean: true
  },
  // Webpack's eval-based development default is incompatible with extension CSP.
  devtool: 'source-map',
  plugins: [new CopyWebpackPlugin({ patterns: [
    { from: 'manifest.json', to: 'manifest.json' },
    { from: 'src', to: 'src', globOptions: { ignore: ['**/*.js', '**/.DS_Store'] } },
    { from: 'icons', to: 'icons', globOptions: { ignore: ['**/*.html', '**/*.md'] } }
  ] })]
};
