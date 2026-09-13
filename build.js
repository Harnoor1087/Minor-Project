const esbuild = require('esbuild');
const path = require('path');
const fs = require('fs');

async function buildReact() {
  const outdir = path.join(__dirname, 'public/dist');
  if (!fs.existsSync(outdir)) {
    fs.mkdirSync(outdir, { recursive: true });
  }

  const entryFile = path.join(__dirname, 'src/react/index.jsx');
  if (!fs.existsSync(entryFile)) {
    console.warn('[Build] No src/react/index.jsx found yet.');
    return;
  }

  try {
    const result = await esbuild.build({
      entryPoints: [entryFile],
      bundle: true,
      minify: process.env.NODE_ENV === 'production',
      sourcemap: true,
      target: ['es2020'],
      outfile: path.join(outdir, 'app.bundle.js'),
      define: {
        'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development')
      },
      loader: {
        '.js': 'jsx',
        '.jsx': 'jsx'
      }
    });
    console.log('[Build] React application compiled successfully to public/dist/app.bundle.js');
    return result;
  } catch (err) {
    console.error('[Build] React build error:', err.message);
  }
}

if (require.main === module) {
  buildReact();
}

module.exports = { buildReact };
