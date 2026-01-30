const fs = require('fs');
const path = require('path');
const dist = path.join(__dirname, '..', 'dist');
const pub = path.join(__dirname, '..', 'public');
const root = path.join(__dirname, '..');

// Copy core files to dist
for (const f of ['preload.cjs', 'logo.png', 'plugin.json']) {
    const src = path.join(pub, f);
    if (fs.existsSync(src)) {
        fs.copyFileSync(src, path.join(dist, f));
        console.log(`[postbuild] Copied ${f} to dist/`);
    }
}

// Copy auxiliary HTMLs to dist (static assets)
for (const f of ['matrix.html', 'popup.html']) {
    if (fs.existsSync(path.join(root, f))) {
        fs.copyFileSync(path.join(root, f), path.join(dist, f));
    }
}

// Copy main.cjs to dist for system plugin entry
if (fs.existsSync(path.join(root, 'main.cjs'))) {
    fs.copyFileSync(path.join(root, 'main.cjs'), path.join(dist, 'main.cjs'));
}

// Read plugin.json metadata
const pluginConfig = JSON.parse(fs.readFileSync(path.join(pub, 'plugin.json'), 'utf-8'));

// Create a distribution version of plugin.json with flat paths
const distPluginConfig = {
    ...pluginConfig,
    main: 'index.html',
    preload: 'preload.cjs',
    entry: 'main.cjs',
    logo: 'logo.png'
};

// Write modified plugin.json to dist
fs.writeFileSync(path.join(dist, 'plugin.json'), JSON.stringify(distPluginConfig, null, 2));

// Generate dist/package.json synced with plugin.json (using flat paths)
const pkgContent = {
    name: pluginConfig.name,
    pluginName: pluginConfig.pluginName,
    version: pluginConfig.version,
    description: pluginConfig.description,
    main: distPluginConfig.main,
    preload: distPluginConfig.preload,
    entry: distPluginConfig.entry,
    logo: distPluginConfig.logo,
    pluginType: pluginConfig.pluginType || 'ui',
    features: pluginConfig.features || []
};

fs.writeFileSync(path.join(dist, 'package.json'), JSON.stringify(pkgContent, null, 2));
console.log('[postbuild] Complete: dist/ is ready');
